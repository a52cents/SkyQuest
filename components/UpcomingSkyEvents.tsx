"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppCard } from "@/components/AppCard";
import { getUpcomingCelestialEvents } from "@/lib/celestial-events";
import { meteorShowers } from "@/lib/meteor-showers";

type UpcomingEvent = {
  id: string;
  title: string;
  date: Date;
  description: string;
  approximateTime: boolean;
};

const WINDOW_DAYS = 60;
const DAY_MS = 86_400_000;

function createUpcomingEvents(now: Date): UpcomingEvent[] {
  const endDate = new Date(now.getTime() + WINDOW_DAYS * DAY_MS);
  const celestialEvents = getUpcomingCelestialEvents(now, WINDOW_DAYS).map<UpcomingEvent>(
    (event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      description: event.description,
      approximateTime: false,
    }),
  );
  const meteorEvents: UpcomingEvent[] = [];

  for (let year = now.getUTCFullYear(); year <= endDate.getUTCFullYear(); year += 1) {
    for (const shower of meteorShowers) {
      const [month, day] = shower.peakDate.split("-").map(Number);
      const peakDate = new Date(Date.UTC(year, month - 1, day, 12));
      if (peakDate < now || peakDate > endDate) continue;
      meteorEvents.push({
        id: `meteor-shower-${shower.id}-${year}`,
        title: `Pic des ${shower.name}`,
        date: peakDate,
        description: shower.recommendedViewingTip,
        approximateTime: true,
      });
    }
  }

  return [...celestialEvents, ...meteorEvents]
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(0, 6);
}

export function UpcomingSkyEvents() {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);

  useEffect(() => setEvents(createUpcomingEvents(new Date())), []);

  return (
    <section className="mt-8" aria-labelledby="upcoming-sky-events-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="premium-kicker">Prochainement</p>
          <h2
            id="upcoming-sky-events-title"
            className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-xl text-text"
          >
            Événements du ciel
          </h2>
        </div>
        <Link href="/explore" className="text-xs font-semibold text-accent-cyan">
          NASA et catalogue →
        </Link>
      </div>
      <div className="mt-4 grid gap-2">
        {events.map((event) => (
          <AppCard as="article" padding="sm" key={event.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-text">{event.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{event.description}</p>
              </div>
              <time
                dateTime={event.date.toISOString()}
                className="shrink-0 text-right text-xs font-semibold text-accent-cyan"
              >
                {new Intl.DateTimeFormat("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: event.approximateTime ? undefined : "2-digit",
                  minute: event.approximateTime ? undefined : "2-digit",
                }).format(event.date)}
                {event.approximateTime ? " · pic approx." : ""}
              </time>
            </div>
          </AppCard>
        ))}
      </div>
    </section>
  );
}
