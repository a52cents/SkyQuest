import * as Astronomy from "astronomy-engine";
import type { SkyObject, SkyObjectName } from "@/lib/types";

const objectNames: SkyObjectName[] = ["Moon", "Venus", "Jupiter", "Saturn", "Mars"];

const magnitudeHintByName: Record<SkyObjectName, SkyObject["magnitudeHint"]> = {
  Moon: "very-bright",
  Venus: "very-bright",
  Jupiter: "bright",
  Saturn: "medium",
  Mars: "medium",
};

const bodyByName: Record<SkyObjectName | "Sun", Astronomy.Body> = {
  Moon: Astronomy.Body.Moon,
  Venus: Astronomy.Body.Venus,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Mars: Astronomy.Body.Mars,
  Sun: Astronomy.Body.Sun,
};

function normalizeLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function createObserver(latitude: number, longitude: number): Astronomy.Observer {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Invalid observer latitude.");
  }

  if (!Number.isFinite(longitude)) {
    throw new Error("Invalid observer longitude.");
  }

  // Browser geolocation and Astronomy.Observer both use north-positive latitude
  // and east-positive longitude. Normalizing longitude avoids wraparound mistakes.
  return new Astronomy.Observer(latitude, normalizeLongitude(longitude), 0);
}

function calculateHorizontalPosition(
  body: Astronomy.Body,
  observer: Astronomy.Observer,
  date: Date,
): { azimuth: number; altitude: number } {
  // Equator(..., ofdate=true, aberration=true) returns apparent topocentric RA/Dec
  // in the true equator/equinox of date, which Astronomy.Horizon expects.
  const equator = Astronomy.Equator(body, date, observer, true, true);
  // "normal" applies Meeus atmospheric refraction, closer to what the eye sees
  // near the horizon than a purely geometric altitude.
  const horizon = Astronomy.Horizon(date, observer, equator.ra, equator.dec, "normal");

  return {
    azimuth: horizon.azimuth,
    altitude: horizon.altitude,
  };
}

export function getSkyObjects(latitude: number, longitude: number, date: Date): SkyObject[] {
  const observer = createObserver(latitude, longitude);

  return objectNames.map((name) => {
    const position = calculateHorizontalPosition(bodyByName[name], observer, date);

    return {
      name,
      azimuth: position.azimuth,
      altitude: position.altitude,
      magnitudeHint: magnitudeHintByName[name],
    };
  });
}

export function equatorialToHorizontal({
  rightAscensionHours,
  declinationDegrees,
  latitude,
  longitude,
  date,
}: {
  rightAscensionHours: number;
  declinationDegrees: number;
  latitude: number;
  longitude: number;
  date: Date;
}): { altitude: number; azimuth: number } {
  const observer = createObserver(latitude, longitude);
  // Catalog RA/Dec values are fixed guide targets. They are adequate for simple
  // quests, while planets and the Moon use full topocentric ephemerides above.
  const horizon = Astronomy.Horizon(date, observer, rightAscensionHours, declinationDegrees, "normal");

  return {
    altitude: horizon.altitude,
    azimuth: horizon.azimuth,
  };
}

export function getSunAltitude(latitude: number, longitude: number, date: Date): number {
  return getSunPosition(latitude, longitude, date).altitude;
}

export function getSunPosition(latitude: number, longitude: number, date: Date): { azimuth: number; altitude: number } {
  const observer = createObserver(latitude, longitude);
  return calculateHorizontalPosition(bodyByName.Sun, observer, date);
}
