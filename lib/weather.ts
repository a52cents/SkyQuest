import type { WeatherForecast, WeatherHour, WeatherNow } from "@/lib/types";
import { Agent, fetch as undiciFetch } from "undici";
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

const OPEN_METEO_CONNECT_TIMEOUT_MS = 20_000;
const OPEN_METEO_REQUEST_TIMEOUT_MS = 25_000;
const OPEN_METEO_RETRY_COUNT = 2;
const OPEN_METEO_RETRY_DELAY_MS = 750;
const OPEN_METEO_CACHE_TTL_MS = 5 * 60 * 1000;

const openMeteoAgent = new Agent({
  connectTimeout: OPEN_METEO_CONNECT_TIMEOUT_MS,
  headersTimeout: OPEN_METEO_REQUEST_TIMEOUT_MS,
  bodyTimeout: OPEN_METEO_REQUEST_TIMEOUT_MS,
});

const openMeteoCache = new Map<string, { expiresAt: number; value: unknown }>();
const openMeteoInFlight = new Map<string, Promise<unknown>>();

class OpenMeteoHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OpenMeteoHttpError";
  }
}

function clampPercent(value: number | null | undefined, fallback: number): number {
  return Math.max(0, Math.min(100, value ?? fallback));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function serializeNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const cause = (error as Error & { cause?: unknown }).cause;

  return {
    name: error.name,
    message: error.message,
    cause:
      cause instanceof Error
        ? {
            name: cause.name,
            message: cause.message,
            code: (cause as Error & { code?: string }).code,
          }
        : cause,
  };
}

async function fetchOpenMeteoJson<T>(url: URL): Promise<T> {
  const cacheKey = url.toString();
  const cached = openMeteoCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const inFlight = openMeteoInFlight.get(cacheKey);

  if (inFlight) {
    return (await inFlight) as T;
  }

  const request = fetchOpenMeteoJsonUncached<T>(url).then((value) => {
    openMeteoCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + OPEN_METEO_CACHE_TTL_MS,
    });

    return value;
  });

  openMeteoInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    openMeteoInFlight.delete(cacheKey);
  }
}

async function fetchOpenMeteoJsonUncached<T>(url: URL): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= OPEN_METEO_RETRY_COUNT; attempt += 1) {
    try {
      const response = await undiciFetch(url.toString(), {
        dispatcher: openMeteoAgent,
        signal: createNetworkTimeoutSignal(OPEN_METEO_REQUEST_TIMEOUT_MS),
        headers: {
          accept: "application/json",
          "user-agent": "SkyQuest/1.0",
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const message = body
          ? `Open-Meteo unavailable: ${response.status} ${body.slice(0, 160)}`
          : `Open-Meteo unavailable: ${response.status}`;

        throw new OpenMeteoHttpError(message, response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      const isHttpError = error instanceof OpenMeteoHttpError;
      const canRetryHttpError = isHttpError && shouldRetryHttpStatus(error.status);
      const shouldRetry = !isHttpError || canRetryHttpError;

      console.warn("[weather] open_meteo_attempt_failed", {
        attempt,
        maxAttempts: OPEN_METEO_RETRY_COUNT,
        path: url.pathname,
        error: serializeNetworkError(error),
      });

      if (!shouldRetry || attempt === OPEN_METEO_RETRY_COUNT) {
        break;
      }

      await wait(OPEN_METEO_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchWeatherNow(latitude: number, longitude: number): Promise<WeatherNow> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("current", "cloud_cover,is_day,temperature_2m");
  url.searchParams.set("timezone", "auto");

  const data = await fetchOpenMeteoJson<OpenMeteoCurrent>(url);

  return {
    cloudCover: clampPercent(data.current?.cloud_cover, 60),
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

  const data = await fetchOpenMeteoJson<OpenMeteoForecast>(url);
  const hourly = data.hourly;

  if (!hourly?.time?.length) {
    throw new Error("Weather forecast is empty");
  }

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

  return {
    hours,
    timezone: "auto",
    isEstimated: true,
  };
}