import {
  getDefaultLightPollutionEstimate,
  getLightPollutionAdvice,
  normalizeLightPollutionScore,
  type LightPollutionEstimate,
  type LightPollutionSource,
} from "./light-pollution.ts";

type ExternalPayload = Partial<LightPollutionEstimate> & {
  data?: Partial<LightPollutionEstimate>;
};

const VALID_SOURCES: ReadonlySet<LightPollutionSource> = new Set([
  "world-atlas",
  "viirs",
  "black-marble",
  "external-api",
  "fallback",
  "unknown",
]);

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseLightPollutionPayload(
  payload: ExternalPayload,
  configuredProvider?: string,
): LightPollutionEstimate {
  const value = payload.data ?? payload;
  const hasMeasurement = [value.score, value.bortleClass, value.sqm, value.radiance].some(
    (measurement) => finiteNumber(measurement) !== undefined,
  );
  if (!hasMeasurement) return getDefaultLightPollutionEstimate();

  const score = normalizeLightPollutionScore({
    score: finiteNumber(value.score),
    bortleClass: finiteNumber(value.bortleClass),
    sqm: finiteNumber(value.sqm),
    radiance: finiteNumber(value.radiance),
  });
  const sourceCandidate = configuredProvider ?? value.source;
  const source = VALID_SOURCES.has(sourceCandidate as LightPollutionSource)
    ? (sourceCandidate as LightPollutionSource)
    : "external-api";

  return {
    ...getLightPollutionAdvice(score),
    score,
    bortleClass: finiteNumber(value.bortleClass),
    sqm: finiteNumber(value.sqm),
    radiance: finiteNumber(value.radiance),
    source,
    confidence:
      value.confidence === "high" || value.confidence === "medium" ? value.confidence : "medium",
    cachedAt: new Date().toISOString(),
  };
}

export async function fetchConfiguredLightPollutionEstimate({
  latitude,
  longitude,
  apiUrl = process.env.LIGHT_POLLUTION_API_URL,
  apiKey = process.env.LIGHT_POLLUTION_API_KEY,
  provider = process.env.LIGHT_POLLUTION_PROVIDER,
  fetchImpl = fetch,
}: {
  latitude: number;
  longitude: number;
  apiUrl?: string;
  apiKey?: string;
  provider?: string;
  fetchImpl?: typeof fetch;
}): Promise<LightPollutionEstimate> {
  if (!apiUrl) {
    return getDefaultLightPollutionEstimate();
  }

  try {
    const url = new URL(apiUrl);
    url.searchParams.set("lat", latitude.toFixed(2));
    url.searchParams.set("lon", longitude.toFixed(2));
    if (provider) url.searchParams.set("provider", provider);

    const headers = new Headers({ Accept: "application/json" });
    if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);
    const response = await fetchImpl(url, {
      headers,
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!response.ok) throw new Error("Light pollution provider unavailable");

    return parseLightPollutionPayload((await response.json()) as ExternalPayload, provider);
  } catch {
    return getDefaultLightPollutionEstimate();
  }
}
