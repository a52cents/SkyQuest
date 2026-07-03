export type NasaApodHighlight = {
  title: string;
  date: string;
  explanation: string;
  imageUrl: string | null;
  mediaType: "image" | "video";
  copyright: string | null;
  sourceUrl: string;
};

export type NasaAsteroidHighlight = {
  name: string;
  approachDate: string;
  approachAt: string;
  missDistanceKm: number;
  diameterMeters: number;
  potentiallyHazardous: boolean;
  sourceUrl: string;
};

export type NasaUpcomingEvent = {
  id: string;
  type: "near_earth_asteroid";
  title: string;
  occursAt: string;
  description: string;
  sourceUrl: string;
};

export type NasaSpaceWeatherHighlight = {
  kind: "solar_flare" | "geomagnetic_storm";
  title: string;
  summary: string;
  occurredAt: string;
  sourceUrl: string;
};

export type NasaAuroraOutlook = {
  level: "notable" | "limited" | "unknown";
  label: string;
  summary: string;
  maxKp: number | null;
};

export type NasaHighlights = {
  generatedAt: string;
  apod: NasaApodHighlight | null;
  asteroid: NasaAsteroidHighlight | null;
  spaceWeather: NasaSpaceWeatherHighlight | null;
  aurora: NasaAuroraOutlook;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: JsonRecord, key: string): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function readNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function apodSourceUrl(date: string): string {
  const compactDate = date.replaceAll("-", "").slice(2);
  return /^\d{6}$/.test(compactDate)
    ? `https://apod.nasa.gov/apod/ap${compactDate}.html`
    : "https://apod.nasa.gov/apod/astropix.html";
}

export function parseApod(value: unknown): NasaApodHighlight | null {
  if (!isRecord(value)) return null;

  const title = readString(value, "title");
  const date = readString(value, "date");
  const explanation = readString(value, "explanation");
  const mediaType = readString(value, "media_type");
  if (!title || !date || !explanation || (mediaType !== "image" && mediaType !== "video")) {
    return null;
  }

  return {
    title,
    date,
    explanation,
    imageUrl: mediaType === "image" ? readString(value, "url") : readString(value, "thumbnail_url"),
    mediaType,
    copyright: readString(value, "copyright"),
    sourceUrl: apodSourceUrl(date),
  };
}

export function parseClosestAsteroid(
  value: unknown,
  notBefore?: Date,
): NasaAsteroidHighlight | null {
  if (!isRecord(value) || !isRecord(value.near_earth_objects)) return null;

  let closest: NasaAsteroidHighlight | null = null;
  for (const asteroids of Object.values(value.near_earth_objects)) {
    if (!Array.isArray(asteroids)) continue;

    for (const asteroid of asteroids) {
      if (!isRecord(asteroid)) continue;
      const approaches = asteroid.close_approach_data;
      const diameter = asteroid.estimated_diameter;
      if (!Array.isArray(approaches) || !isRecord(diameter) || !isRecord(diameter.meters)) {
        continue;
      }

      const minDiameter = readNumber(diameter.meters.estimated_diameter_min);
      const maxDiameter = readNumber(diameter.meters.estimated_diameter_max);
      const name = readString(asteroid, "name");
      const sourceUrl = readString(asteroid, "nasa_jpl_url");
      if (minDiameter === null || maxDiameter === null || !name || !sourceUrl) continue;

      for (const approach of approaches) {
        if (!isRecord(approach) || !isRecord(approach.miss_distance)) continue;
        const missDistanceKm = readNumber(approach.miss_distance.kilometers);
        const approachDate = readString(approach, "close_approach_date");
        if (missDistanceKm === null || !approachDate) continue;
        const approachEpoch = readNumber(approach.epoch_date_close_approach);
        const approachAt =
          approachEpoch !== null
            ? new Date(approachEpoch).toISOString()
            : `${approachDate}T12:00:00.000Z`;
        if (notBefore && new Date(approachAt) < notBefore) continue;

        const candidate: NasaAsteroidHighlight = {
          name: name.replace(/^\((.+)\)$/, "$1"),
          approachDate,
          approachAt,
          missDistanceKm,
          diameterMeters: (minDiameter + maxDiameter) / 2,
          potentiallyHazardous: asteroid.is_potentially_hazardous_asteroid === true,
          sourceUrl,
        };
        if (!closest || candidate.missDistanceKm < closest.missDistanceKm) closest = candidate;
      }
    }
  }

  return closest;
}

function formatNasaDistance(distanceKm: number): string {
  if (distanceKm >= 1_000_000) {
    const millions = distanceKm / 1_000_000;
    const unit = millions < 2 ? "million" : "millions";
    return `${millions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${unit} de km`;
  }
  return `${Math.round(distanceKm).toLocaleString("fr-FR")} km`;
}

export function getNasaUpcomingEvents(
  highlights: NasaHighlights,
  startDate: Date,
  horizonDays: number,
): NasaUpcomingEvent[] {
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(horizonDays) || horizonDays <= 0) {
    return [];
  }

  const asteroid = highlights.asteroid;
  if (!asteroid) return [];
  const occursAt = new Date(asteroid.approachAt);
  const horizonEnd = new Date(startDate.getTime() + horizonDays * 86_400_000);
  if (!Number.isFinite(occursAt.getTime()) || occursAt < startDate || occursAt > horizonEnd)
    return [];

  return [
    {
      id: `nasa-neo-${asteroid.name}-${asteroid.approachAt}`,
      type: "near_earth_asteroid",
      title: `Passage de ${asteroid.name}`,
      occursAt: asteroid.approachAt,
      description: `À environ ${formatNasaDistance(asteroid.missDistanceKm)} de la Terre · information NASA, non observable à l’œil nu.`,
      sourceUrl: asteroid.sourceUrl,
    },
  ];
}

function geomagneticEvents(value: unknown): Array<NasaSpaceWeatherHighlight & { maxKp: number }> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((event) => {
    if (!isRecord(event) || !Array.isArray(event.allKpIndex)) return [];
    const kpReadings = event.allKpIndex
      .map((reading) => (isRecord(reading) ? readNumber(reading.KpIndex) : null))
      .filter((kp): kp is number => kp !== null);
    const occurredAt = readString(event, "startTime");
    const sourceUrl = readString(event, "link");
    if (!occurredAt || !sourceUrl || kpReadings.length === 0) return [];

    const maxKp = Math.max(...kpReadings);
    return [
      {
        kind: "geomagnetic_storm" as const,
        title: "Activité géomagnétique",
        summary: `Un indice Kp maximal de ${maxKp.toLocaleString("fr-FR")} a été relevé.`,
        occurredAt,
        sourceUrl,
        maxKp,
      },
    ];
  });
}

function flareEvents(value: unknown): NasaSpaceWeatherHighlight[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((event) => {
    if (!isRecord(event)) return [];
    const occurredAt = readString(event, "peakTime") ?? readString(event, "beginTime");
    const sourceUrl = readString(event, "link");
    const classType = readString(event, "classType");
    if (!occurredAt || !sourceUrl || !classType) return [];

    return [
      {
        kind: "solar_flare" as const,
        title: "Éruption solaire",
        summary: `Une éruption de classe ${classType} a été observée par les instruments solaires.`,
        occurredAt,
        sourceUrl,
      },
    ];
  });
}

export function summarizeSpaceWeather(
  stormsValue: unknown,
  flaresValue: unknown,
): Pick<NasaHighlights, "spaceWeather" | "aurora"> {
  const storms = geomagneticEvents(stormsValue);
  const events = [...storms, ...flareEvents(flaresValue)].sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  );
  const maxKp = storms.length ? Math.max(...storms.map((storm) => storm.maxKp)) : null;

  if (maxKp !== null && maxKp >= 5) {
    return {
      spaceWeather: events[0] ?? null,
      aurora: {
        level: "notable",
        label: "Activité à surveiller",
        summary:
          "Une activité géomagnétique notable a été relevée récemment. Des aurores peuvent être possibles aux hautes latitudes, sans garantie locale.",
        maxKp,
      },
    };
  }

  if (maxKp !== null) {
    return {
      spaceWeather: events[0] ?? null,
      aurora: {
        level: "limited",
        label: "Signal limité",
        summary:
          "L’activité géomagnétique récente reste sous le seuil généralement associé à une tempête. Ce n’est pas une prévision locale.",
        maxKp,
      },
    };
  }

  return {
    spaceWeather: events[0] ?? null,
    aurora: {
      level: "unknown",
      label: "Pas de signal récent",
      summary:
        "DONKI ne signale pas d’épisode géomagnétique récent dans les données reçues. Cela ne vaut pas prévision locale.",
      maxKp: null,
    },
  };
}

async function fetchNasaJson(url: URL): Promise<unknown> {
  try {
    const response = await fetch(url, {
      next: { revalidate: 21_600 },
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? ((await response.json()) as unknown) : null;
  } catch {
    return null;
  }
}

export async function getNasaHighlights(now = new Date()): Promise<NasaHighlights> {
  const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";
  const today = toUtcDate(now);
  const weekEnd = toUtcDate(addUtcDays(now, 6));
  const recentStart = toUtcDate(addUtcDays(now, -7));

  const apodUrl = new URL("https://api.nasa.gov/planetary/apod");
  apodUrl.searchParams.set("api_key", apiKey);
  apodUrl.searchParams.set("thumbs", "true");

  const neoUrl = new URL("https://api.nasa.gov/neo/rest/v1/feed");
  neoUrl.searchParams.set("start_date", today);
  neoUrl.searchParams.set("end_date", weekEnd);
  neoUrl.searchParams.set("api_key", apiKey);

  const stormUrl = new URL("https://api.nasa.gov/DONKI/GST");
  stormUrl.searchParams.set("startDate", recentStart);
  stormUrl.searchParams.set("endDate", today);
  stormUrl.searchParams.set("api_key", apiKey);

  const flareUrl = new URL("https://api.nasa.gov/DONKI/FLR");
  flareUrl.searchParams.set("startDate", recentStart);
  flareUrl.searchParams.set("endDate", today);
  flareUrl.searchParams.set("api_key", apiKey);

  const [apodValue, asteroidsValue, stormsValue, flaresValue] = await Promise.all([
    fetchNasaJson(apodUrl),
    fetchNasaJson(neoUrl),
    fetchNasaJson(stormUrl),
    fetchNasaJson(flareUrl),
  ]);
  const weather = summarizeSpaceWeather(stormsValue, flaresValue);

  return {
    generatedAt: now.toISOString(),
    apod: parseApod(apodValue),
    asteroid: parseClosestAsteroid(asteroidsValue, now),
    ...weather,
  };
}
