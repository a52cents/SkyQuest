import * as Astronomy from "astronomy-engine";

export type CelestialEventType =
  | "full_moon"
  | "new_moon"
  | "supermoon"
  | "lunar_eclipse"
  | "solar_eclipse"
  | "equinox"
  | "solstice";

export type CelestialEvent = {
  id: string;
  type: CelestialEventType;
  title: string;
  date: Date;
  description: string;
  details?: {
    distanceKm?: number;
    obscuration?: number;
    eclipseKind?: Astronomy.EclipseKind;
  };
};

const DAY_MS = 86_400_000;
const SUPERMOON_MAX_DISTANCE_KM = 360_000;
const SUPERMOON_MAX_OFFSET_MS = 48 * 60 * 60 * 1000;

function isWithinRange(date: Date, startDate: Date, endDate: Date): boolean {
  const timestamp = date.getTime();
  return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
}

function createEventId(type: CelestialEventType, date: Date): string {
  return `${type}-${date.toISOString()}`;
}

function searchMoonPhases(targetLongitude: 0 | 180, startDate: Date, endDate: Date): Date[] {
  const phases: Date[] = [];
  let cursor = new Date(startDate);

  while (cursor <= endDate) {
    const remainingDays = (endDate.getTime() - cursor.getTime()) / DAY_MS;
    if (remainingDays < 0) break;

    const phase = Astronomy.SearchMoonPhase(targetLongitude, cursor, remainingDays + 0.001);
    if (!phase || phase.date > endDate) break;

    phases.push(new Date(phase.date));
    cursor = new Date(phase.date.getTime() + 60_000);
  }

  return phases;
}

function searchNearbyPerigees(startDate: Date, endDate: Date): Astronomy.Apsis[] {
  const searchStart = new Date(startDate.getTime() - SUPERMOON_MAX_OFFSET_MS);
  const searchEnd = new Date(endDate.getTime() + SUPERMOON_MAX_OFFSET_MS);
  const perigees: Astronomy.Apsis[] = [];
  let apsis = Astronomy.SearchLunarApsis(searchStart);

  while (apsis.time.date <= searchEnd) {
    if (apsis.kind === Astronomy.ApsisKind.Pericenter) perigees.push(apsis);
    apsis = Astronomy.NextLunarApsis(apsis);
  }

  return perigees;
}

function lunarEclipseTitle(kind: Astronomy.EclipseKind): string {
  if (kind === Astronomy.EclipseKind.Total) return "Éclipse lunaire totale";
  if (kind === Astronomy.EclipseKind.Partial) return "Éclipse lunaire partielle";
  return "Éclipse lunaire pénombrale";
}

function solarEclipseTitle(kind: Astronomy.EclipseKind): string {
  if (kind === Astronomy.EclipseKind.Total) return "Éclipse solaire totale";
  if (kind === Astronomy.EclipseKind.Annular) return "Éclipse solaire annulaire";
  return "Éclipse solaire partielle";
}

function addSeasonEvents(events: CelestialEvent[], startDate: Date, endDate: Date) {
  for (let year = startDate.getUTCFullYear(); year <= endDate.getUTCFullYear(); year += 1) {
    const seasons = Astronomy.Seasons(year);
    const entries: Array<{
      type: "equinox" | "solstice";
      title: string;
      date: Date;
      description: string;
    }> = [
      {
        type: "equinox",
        title: "Équinoxe de mars",
        date: seasons.mar_equinox.date,
        description: "Début astronomique du printemps dans l’hémisphère Nord.",
      },
      {
        type: "solstice",
        title: "Solstice de juin",
        date: seasons.jun_solstice.date,
        description: "Début astronomique de l’été dans l’hémisphère Nord.",
      },
      {
        type: "equinox",
        title: "Équinoxe de septembre",
        date: seasons.sep_equinox.date,
        description: "Début astronomique de l’automne dans l’hémisphère Nord.",
      },
      {
        type: "solstice",
        title: "Solstice de décembre",
        date: seasons.dec_solstice.date,
        description: "Début astronomique de l’hiver dans l’hémisphère Nord.",
      },
    ];

    entries.forEach((entry) => {
      if (!isWithinRange(entry.date, startDate, endDate)) return;
      events.push({
        ...entry,
        date: new Date(entry.date),
        id: createEventId(entry.type, entry.date),
      });
    });
  }
}

export function getUpcomingCelestialEvents(startDate: Date, limitDays: number): CelestialEvent[] {
  if (!Number.isFinite(startDate.getTime())) throw new Error("Invalid celestial event start date.");
  if (!Number.isFinite(limitDays) || limitDays <= 0) return [];

  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(rangeStart.getTime() + limitDays * DAY_MS);
  const events: CelestialEvent[] = [];
  const perigees = searchNearbyPerigees(rangeStart, rangeEnd);

  searchMoonPhases(180, rangeStart, rangeEnd).forEach((date) => {
    const matchingPerigee = perigees
      .filter((apsis) => apsis.dist_km < SUPERMOON_MAX_DISTANCE_KM)
      .sort(
        (left, right) =>
          Math.abs(left.time.date.getTime() - date.getTime()) -
          Math.abs(right.time.date.getTime() - date.getTime()),
      )
      .find(
        (apsis) => Math.abs(apsis.time.date.getTime() - date.getTime()) <= SUPERMOON_MAX_OFFSET_MS,
      );

    if (matchingPerigee) {
      const distanceKm = Math.round(matchingPerigee.dist_km);
      events.push({
        id: createEventId("supermoon", date),
        type: "supermoon",
        title: "Super Lune",
        date,
        description: `Pleine lune proche du périgée lunaire calculé à ${distanceKm.toLocaleString("fr-FR")} km.`,
        details: { distanceKm },
      });
      return;
    }

    events.push({
      id: createEventId("full_moon", date),
      type: "full_moon",
      title: "Pleine Lune",
      date,
      description: "La Lune atteint sa phase pleine géocentrique.",
    });
  });

  searchMoonPhases(0, rangeStart, rangeEnd).forEach((date) => {
    events.push({
      id: createEventId("new_moon", date),
      type: "new_moon",
      title: "Nouvelle Lune",
      date,
      description: "La Lune atteint sa nouvelle phase, favorable à un ciel nocturne plus sombre.",
    });
  });

  const lunarEclipse = Astronomy.SearchLunarEclipse(rangeStart);
  if (isWithinRange(lunarEclipse.peak.date, rangeStart, rangeEnd)) {
    events.push({
      id: createEventId("lunar_eclipse", lunarEclipse.peak.date),
      type: "lunar_eclipse",
      title: lunarEclipseTitle(lunarEclipse.kind),
      date: new Date(lunarEclipse.peak.date),
      description:
        lunarEclipse.kind === Astronomy.EclipseKind.Penumbral
          ? "Maximum d’une éclipse pénombrale de Lune calculée à l’échelle mondiale."
          : `Maximum mondial calculé · ${Math.round(lunarEclipse.obscuration * 100)} % du disque lunaire obscurci.`,
      details: { eclipseKind: lunarEclipse.kind, obscuration: lunarEclipse.obscuration },
    });
  }

  const solarEclipse = Astronomy.SearchGlobalSolarEclipse(rangeStart);
  if (isWithinRange(solarEclipse.peak.date, rangeStart, rangeEnd)) {
    const obscurationText =
      typeof solarEclipse.obscuration === "number"
        ? ` · ${Math.round(solarEclipse.obscuration * 100)} % au maximum global`
        : "";
    events.push({
      id: createEventId("solar_eclipse", solarEclipse.peak.date),
      type: "solar_eclipse",
      title: solarEclipseTitle(solarEclipse.kind),
      date: new Date(solarEclipse.peak.date),
      description: `Maximum de l’éclipse calculé à l’échelle mondiale${obscurationText}. La visibilité locale dépend du lieu.`,
      details: { eclipseKind: solarEclipse.kind, obscuration: solarEclipse.obscuration },
    });
  }

  addSeasonEvents(events, rangeStart, rangeEnd);
  const eclipseEvents = events.filter(
    (event) => event.type === "lunar_eclipse" || event.type === "solar_eclipse",
  );
  const withoutDuplicatedPhases = events.filter((event) => {
    if (event.type !== "full_moon" && event.type !== "new_moon") return true;
    const matchingEclipseType = event.type === "full_moon" ? "lunar_eclipse" : "solar_eclipse";
    return !eclipseEvents.some(
      (eclipse) =>
        eclipse.type === matchingEclipseType &&
        Math.abs(eclipse.date.getTime() - event.date.getTime()) <= 12 * 60 * 60 * 1000,
    );
  });

  return withoutDuplicatedPhases.sort((left, right) => left.date.getTime() - right.date.getTime());
}
