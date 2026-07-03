import type { AirQualityNow, QuestTargetType } from "./types";

export type AirTransparencyLevel = "clear" | "slight-haze" | "hazy" | "very-hazy";

export type AirTransparencyEstimate = {
  level: AirTransparencyLevel;
  label: string;
  shortAdvice: string;
  weakTargetPenalty: number;
};

type OpenMeteoAirQualityResponse = {
  current?: {
    pm10?: number;
    pm2_5?: number;
    european_aqi?: number;
    aerosol_optical_depth?: number;
    dust?: number;
  };
};

const TARGET_SENSITIVITY: Record<QuestTargetType, number> = {
  moon: 0.25,
  planet: 0.35,
  star: 0.6,
  constellation: 0.8,
  asterism: 0.8,
  meteor_shower: 1,
  star_cluster: 1,
  galaxy: 1,
  satellite: 0.3,
  free_observation: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function severityBetween(value: number | undefined, clearAt: number, strongAt: number): number {
  if (value === undefined) return 0;
  return clamp((value - clearAt) / (strongAt - clearAt), 0, 1);
}

export function getAirTransparencyEstimate(airQuality: AirQualityNow): AirTransparencyEstimate {
  const severity = Math.max(
    severityBetween(airQuality.aerosolOpticalDepth, 0.08, 0.6),
    severityBetween(airQuality.pm2_5, 10, 75),
    severityBetween(airQuality.pm10, 20, 150),
    severityBetween(airQuality.dust, 20, 200),
  );
  const weakTargetPenalty = Math.round(severity * 10);

  if (weakTargetPenalty <= 1) {
    return {
      level: "clear",
      label: "Air plutôt limpide",
      shortAdvice: "Peu de voile atmosphérique est estimé actuellement.",
      weakTargetPenalty,
    };
  }
  if (weakTargetPenalty <= 4) {
    return {
      level: "slight-haze",
      label: "Léger voile possible",
      shortAdvice: "Les objets faibles peuvent perdre un peu de contraste.",
      weakTargetPenalty,
    };
  }
  if (weakTargetPenalty <= 7) {
    return {
      level: "hazy",
      label: "Air chargé",
      shortAdvice: "Privilégie la Lune, les planètes et les étoiles brillantes.",
      weakTargetPenalty,
    };
  }
  return {
    level: "very-hazy",
    label: "Voile atmosphérique marqué",
    shortAdvice: "Les galaxies et autres cibles faibles risquent de manquer de contraste.",
    weakTargetPenalty,
  };
}

export function getTargetAirQualityPenalty(
  targetType: QuestTargetType,
  airQuality: AirQualityNow,
): number {
  const estimate = getAirTransparencyEstimate(airQuality);
  return Math.round(estimate.weakTargetPenalty * TARGET_SENSITIVITY[targetType]);
}

export async function fetchAirQualityNow(
  latitude: number,
  longitude: number,
): Promise<AirQualityNow> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", (Math.round(latitude * 100) / 100).toFixed(2));
  url.searchParams.set("longitude", (Math.round(longitude * 100) / 100).toFixed(2));
  url.searchParams.set("current", "pm10,pm2_5,european_aqi,aerosol_optical_depth,dust");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Air quality unavailable");
  const data = (await response.json()) as OpenMeteoAirQualityResponse;
  if (!data.current) throw new Error("Air quality response is empty");

  return {
    europeanAqi: finite(data.current.european_aqi),
    pm2_5: finite(data.current.pm2_5),
    pm10: finite(data.current.pm10),
    aerosolOpticalDepth: finite(data.current.aerosol_optical_depth),
    dust: finite(data.current.dust),
  };
}
