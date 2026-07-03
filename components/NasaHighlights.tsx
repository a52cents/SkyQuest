"use client";

import { useEffect, useState } from "react";
import { AppCard } from "@/components/AppCard";
import type { NasaHighlights as NasaHighlightsData } from "@/lib/nasa";

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", options ?? { day: "numeric", month: "long" }).format(
    new Date(value),
  );
}

function formatDistance(distanceKm: number) {
  if (distanceKm >= 1_000_000) {
    return `${(distanceKm / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} millions de km`;
  }
  return `${Math.round(distanceKm).toLocaleString("fr-FR")} km`;
}

function LoadingCards() {
  return (
    <div className="grid animate-pulse gap-3" aria-label="Chargement des nouvelles de la NASA">
      <div className="h-64 rounded-[20px] border border-white/[0.06] bg-surface" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-40 rounded-[20px] border border-white/[0.06] bg-surface" />
        <div className="h-40 rounded-[20px] border border-white/[0.06] bg-surface" />
      </div>
    </div>
  );
}

export function NasaHighlights() {
  const [data, setData] = useState<NasaHighlightsData | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHighlights() {
      try {
        const response = await fetch("/api/nasa/highlights", { signal: controller.signal });
        if (!response.ok) throw new Error("NASA highlights unavailable");
        setData((await response.json()) as NasaHighlightsData);
      } catch {
        if (!controller.signal.aborted) setIsUnavailable(true);
      }
    }

    void loadHighlights();
    return () => controller.abort();
  }, []);

  if (!data && !isUnavailable) return <LoadingCards />;

  if (!data || (!data.apod && !data.asteroid && !data.spaceWeather)) {
    return (
      <AppCard variant="subtle" padding="sm">
        <p className="text-sm font-medium text-text">Les nouvelles spatiales font une pause.</p>
        <p className="mt-1 text-xs leading-5 text-muted">
          Le catalogue du ciel reste disponible juste au-dessus. Réessaie un peu plus tard.
        </p>
      </AppCard>
    );
  }

  return (
    <div className="grid gap-3">
      {data.apod ? (
        <AppCard as="article" padding="sm" className="overflow-hidden">
          {data.apod.imageUrl ? (
            // NASA APOD peut servir ses médias depuis plusieurs domaines partenaires.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.apod.imageUrl}
              alt=""
              className="aspect-[16/10] w-full rounded-[14px] bg-surface object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="pt-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-cyan">
              Image astro du jour · NASA
            </span>
            <h3 className="mt-2 font-[Georgia,'Times_New_Roman',serif] text-xl text-text">
              {data.apod.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">
              {data.apod.explanation}
            </p>
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/[0.06] pt-3">
              <p className="text-[11px] leading-4 text-faint">
                {formatDate(data.apod.date)}
                {data.apod.copyright ? ` · © ${data.apod.copyright}` : ""}
              </p>
              <a
                href={data.apod.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs font-semibold text-accent-cyan hover:underline"
              >
                Voir chez NASA
              </a>
            </div>
          </div>
        </AppCard>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {data.asteroid ? (
          <AppCard as="article" padding="sm" variant="solid">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
              Passage de la semaine
            </span>
            <h3 className="mt-2 text-base font-semibold text-text">{data.asteroid.name}</h3>
            <p className="mt-2 text-sm leading-5 text-muted">
              Approche le {formatDate(data.asteroid.approachDate)} à environ{" "}
              {formatDistance(data.asteroid.missDistanceKm)} de la Terre.
            </p>
            <p className="mt-3 text-xs leading-5 text-faint">
              Diamètre estimé : environ {Math.round(data.asteroid.diameterMeters)} m. Ce passage
              astronomique n’est pas une promesse d’observation à l’œil nu.
            </p>
            <a
              href={data.asteroid.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-xs font-semibold text-accent-cyan hover:underline"
            >
              Fiche NASA JPL
            </a>
          </AppCard>
        ) : null}

        <AppCard as="article" padding="sm" variant="solid">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
            Aurores · signal spatial
          </span>
          <h3 className="mt-2 text-base font-semibold text-text">{data.aurora.label}</h3>
          <p className="mt-2 text-sm leading-5 text-muted">{data.aurora.summary}</p>
          {data.aurora.maxKp !== null ? (
            <p className="mt-3 text-xs text-faint">Kp maximal récent : {data.aurora.maxKp}</p>
          ) : null}
        </AppCard>
      </div>

      {data.spaceWeather ? (
        <AppCard as="article" padding="sm" variant="subtle">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-cyan">
                Événement spatial récent
              </span>
              <h3 className="mt-2 text-base font-semibold text-text">{data.spaceWeather.title}</h3>
              <p className="mt-1 text-sm leading-5 text-muted">{data.spaceWeather.summary}</p>
              <p className="mt-2 text-xs text-faint">
                {formatDate(data.spaceWeather.occurredAt, {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <a
              href={data.spaceWeather.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Voir l’événement dans DONKI"
              className="shrink-0 rounded-full border border-white/[0.08] px-3 py-2 text-xs font-semibold text-accent-cyan hover:border-accent-cyan/30"
            >
              DONKI
            </a>
          </div>
        </AppCard>
      ) : null}
    </div>
  );
}
