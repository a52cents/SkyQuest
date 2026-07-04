import { createNetworkTimeoutSignal } from "@/lib/network";
import type { OMMJsonObject } from "satellite.js";

const CELESTRAK_GP_URL = "https://celestrak.org/NORAD/elements/gp.php";
const CELESTRAK_CACHE_SECONDS = 2 * 60 * 60;

type CachedElements = { value: OMMJsonObject[]; expiresAt: number };

const cachedElements = new Map<string, CachedElements>();
const pendingElements = new Map<string, Promise<OMMJsonObject[]>>();

function isOmmObject(value: unknown): value is OMMJsonObject {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  const numericFields = [
    "MEAN_MOTION",
    "ECCENTRICITY",
    "INCLINATION",
    "RA_OF_ASC_NODE",
    "ARG_OF_PERICENTER",
    "MEAN_ANOMALY",
    "NORAD_CAT_ID",
    "ELEMENT_SET_NO",
    "BSTAR",
    "MEAN_MOTION_DOT",
    "MEAN_MOTION_DDOT",
  ];

  return (
    typeof candidate.OBJECT_NAME === "string" &&
    typeof candidate.OBJECT_ID === "string" &&
    typeof candidate.EPOCH === "string" &&
    Number.isInteger(Number(candidate.NORAD_CAT_ID)) &&
    numericFields.every(
      (field) =>
        (typeof candidate[field] === "number" || typeof candidate[field] === "string") &&
        Number.isFinite(Number(candidate[field])),
    )
  );
}

async function requestElements(query: string): Promise<OMMJsonObject[]> {
  const url = new URL(CELESTRAK_GP_URL);
  const [key, value] = query.split("=");
  url.searchParams.set(key, value);
  url.searchParams.set("FORMAT", "JSON");

  const response = await fetch(url, {
    next: { revalidate: CELESTRAK_CACHE_SECONDS },
    signal: createNetworkTimeoutSignal(),
  });

  if (!response.ok) {
    throw new Error(`CelesTrak returned HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const orbitalElements = Array.isArray(payload) ? payload.filter(isOmmObject) : [];
  if (orbitalElements.length === 0) {
    throw new Error("CelesTrak returned invalid orbital elements.");
  }

  cachedElements.set(query, {
    value: orbitalElements,
    expiresAt: Date.now() + CELESTRAK_CACHE_SECONDS * 1000,
  });
  return orbitalElements;
}

async function fetchElements(query: string): Promise<OMMJsonObject[]> {
  const cached = cachedElements.get(query);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!pendingElements.has(query)) {
    const request = requestElements(query).finally(() => {
      pendingElements.delete(query);
    });
    pendingElements.set(query, request);
  }

  try {
    return await pendingElements.get(query)!;
  } catch (error) {
    // Des éléments un peu anciens restent plus utiles qu'une panne totale et évitent les retries en rafale.
    if (cached) return cached.value;
    throw error;
  }
}

/** Lit les GP publics sans interroger une même collection plus d'une fois toutes les deux heures. */
export async function fetchIssOrbitalElements(): Promise<OMMJsonObject> {
  const elements = await fetchElements("CATNR=25544");
  const iss = elements.find((element) => Number(element.NORAD_CAT_ID) === 25544);
  if (!iss) throw new Error("CelesTrak did not return ISS orbital elements.");
  return iss;
}

export function fetchBrightSatelliteElements(): Promise<OMMJsonObject[]> {
  return fetchElements("GROUP=VISUAL");
}

export async function fetchRecentStarlinkElements(): Promise<OMMJsonObject[]> {
  const elements = await fetchElements("GROUP=LAST-30-DAYS");
  return elements.filter((element) => element.OBJECT_NAME.toUpperCase().startsWith("STARLINK-"));
}
