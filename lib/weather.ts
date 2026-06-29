import type { WeatherNow } from "@/lib/types";

type OpenMeteoCurrent = {
  current?: {
    cloud_cover?: number;
    is_day?: number;
    temperature_2m?: number;
  };
};

export async function fetchWeatherNow(latitude: number, longitude: number): Promise<WeatherNow> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("current", "cloud_cover,is_day,temperature_2m");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url.toString(), { cache: "no-store" });

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
