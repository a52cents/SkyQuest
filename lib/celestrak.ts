import { createNetworkTimeoutSignal } from "@/lib/network";
import type { OMMJsonObject } from "satellite.js";

const CELESTRAK_ISS_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON";
const CELESTRAK_CACHE_SECONDS = 2 * 60 * 60;

let cachedIssElements: { value: OMMJsonObject; expiresAt: number } | null = null;
let pendingIssElements: Promise<OMMJsonObject> | null = null;

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
    Number(candidate.NORAD_CAT_ID) === 25544 &&
    numericFields.every(
      (field) =>
        (typeof candidate[field] === "number" || typeof candidate[field] === "string") &&
        Number.isFinite(Number(candidate[field])),
    )
  );
}

async function requestIssElements(): Promise<OMMJsonObject> {
  const response = await fetch(CELESTRAK_ISS_URL, {
    next: { revalidate: CELESTRAK_CACHE_SECONDS },
    signal: createNetworkTimeoutSignal(),
  });

  if (!response.ok) {
    throw new Error(`CelesTrak returned HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const orbitalElements = Array.isArray(payload) ? payload[0] : null;
  if (!isOmmObject(orbitalElements)) {
    throw new Error("CelesTrak returned invalid ISS orbital elements.");
  }

  cachedIssElements = {
    value: orbitalElements,
    expiresAt: Date.now() + CELESTRAK_CACHE_SECONDS * 1000,
  };
  return orbitalElements;
}

/** Lit les GP publics de l'ISS sans interroger CelesTrak plus d'une fois toutes les deux heures. */
export async function fetchIssOrbitalElements(): Promise<OMMJsonObject> {
  if (cachedIssElements && cachedIssElements.expiresAt > Date.now()) {
    return cachedIssElements.value;
  }

  if (!pendingIssElements) {
    pendingIssElements = requestIssElements().finally(() => {
      pendingIssElements = null;
    });
  }

  try {
    return await pendingIssElements;
  } catch (error) {
    // Des éléments un peu anciens restent plus utiles qu'une panne totale et évitent les retries en rafale.
    if (cachedIssElements) return cachedIssElements.value;
    throw error;
  }
}
