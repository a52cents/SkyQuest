import type { WeatherForecast, WeatherHour, WeatherNow } from "@/lib/types";
import { createNetworkTimeoutSignal } from "./network.ts";

type OpenMeteoCurrent = {
  current?: {
    cloud_cover?: number;
    is_day?: number;
    temperature_2m?: number;
  };
};

type OpenMeteoForecast = {
  timezone?: string;
  utc_offset_seconds?: number;
  hourly?: {
    time?: number[];
    cloud_cover?: Array<number | null>;
    relative_humidity_2m?: Array<number | null>;
    temperature_2m?: Array<number | null>;
    dew_point_2m?: Array<number | null>;
    visibility?: Array<number | null>;
  };
};

function clampPercent(value: number | null | undefined, fallback: number): number {
  return Math.max(0, Math.min(100, value ?? fallback));
}

export async function fetchWeatherNow(latitude: number, longitude: number): Promise<WeatherNow> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("current", "cloud_cover,is_day,temperature_2m");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: createNetworkTimeoutSignal(),
  });

  if (!response.ok) {
    throw new Error("Weather unavailable");
  }

  const data = (await response.json()) as OpenMeteoCurrent;

  return {
    cloudCover: Math.max(0, Math.min(100, data.current?.cloud_cover ?? 60)),
    isDay: data.current?.is_day === 1,
    temperature: data.current?.temperature_2m,
  };
}

export function getFallbackWeather(): WeatherNow {
  return {
    cloudCover: 65,
    isDay: false,
  };
}

export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  horizonHours = 24,
): Promise<WeatherForecast> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set(
    "hourly",
    "cloud_cover,relative_humidity_2m,temperature_2m,dew_point_2m,visibility",
  );
  url.searchParams.set("forecast_hours", Math.max(12, Math.min(48, horizonHours)).toString());
  url.searchParams.set("timeformat", "unixtime");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: createNetworkTimeoutSignal(),
  });
  if (!response.ok) throw new Error("Weather forecast unavailable");

  const data = (await response.json()) as OpenMeteoForecast;
  const hourly = data.hourly;
  if (!hourly?.time?.length) throw new Error("Weather forecast is empty");

  const hours = hourly.time.flatMap<WeatherHour>((unixSeconds, index) => {
    if (!Number.isFinite(unixSeconds)) return [];
    const temperature = hourly.temperature_2m?.[index];
    const dewPoint = hourly.dew_point_2m?.[index];
    const visibility = hourly.visibility?.[index];
    return [
      {
        date: new Date(unixSeconds * 1000).toISOString(),
        cloudCover: clampPercent(hourly.cloud_cover?.[index], 65),
        relativeHumidity: clampPercent(hourly.relative_humidity_2m?.[index], 80),
        temperature: typeof temperature === "number" ? temperature : undefined,
        dewPoint: typeof dewPoint === "number" ? dewPoint : undefined,
        visibilityMeters: typeof visibility === "number" ? Math.max(0, visibility) : undefined,
      },
    ];
  });

  return {
    hours,
    timezone: data.timezone ?? "auto",
    isEstimated: false,
  };
}

export function getFallbackWeatherForecast(now = new Date(), horizonHours = 24): WeatherForecast {
  const firstHour = new Date(now);
  firstHour.setUTCMinutes(0, 0, 0);
  const hours = Array.from({ length: horizonHours }, (_, index): WeatherHour => ({
    date: new Date(firstHour.getTime() + index * 60 * 60 * 1000).toISOString(),
    cloudCover: 65,
    relativeHumidity: 80,
  }));
  return { hours, timezone: "auto", isEstimated: true };
}
