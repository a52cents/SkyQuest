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

function calculateHorizontalPosition(
  body: Astronomy.Body,
  observer: Astronomy.Observer,
  date: Date,
): { azimuth: number; altitude: number } {
  const equator = Astronomy.Equator(body, date, observer, true, true);
  const horizon = Astronomy.Horizon(date, observer, equator.ra, equator.dec, "normal");

  return {
    azimuth: horizon.azimuth,
    altitude: horizon.altitude,
  };
}

export function getSkyObjects(latitude: number, longitude: number, date: Date): SkyObject[] {
  const observer = new Astronomy.Observer(latitude, longitude, 0);

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

export function getSunAltitude(latitude: number, longitude: number, date: Date): number {
  return getSunPosition(latitude, longitude, date).altitude;
}

export function getSunPosition(latitude: number, longitude: number, date: Date): { azimuth: number; altitude: number } {
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  return calculateHorizontalPosition(bodyByName.Sun, observer, date);
}
