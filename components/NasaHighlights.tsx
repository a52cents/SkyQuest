"use client";

import Link from "next/link";
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

function CompactHighlight({
  data,
  isUnavailable,
}: {
  data: NasaHighlightsData | null;
  isUnavailable: boolean;
}) {
  if (!data && !isUnavailable) {
    return (
      <div
        className="h-28 animate-pulse rounded-[20px] border border-white/[0.06] bg-surface"
        aria-label="Chargement des actualités spatiales"
      />
    );
  }

  const headline = data?.apod
    ? { label: "Image astro du jour · NASA", title: data.apod.title, imageUrl: data.apod.imageUrl }
    : data?.spaceWeather
      ? { label: "Événement spatial récent", title: data.spaceWeather.title, imageUrl: null }
      : data?.asteroid
        ? { label: "Passage de la semaine", title: data.asteroid.name, imageUrl: null }
        : data
          ? { label: "Aurores · signal spatial", title: data.aurora.label, imageUrl: null }
          : null;

  return (
    <AppCard as="article" variant="solid" padding="sm" className="overflow-hidden">
      <div className="flex items-center gap-3">
        {headline?.imageUrl ? (
          // NASA APOD peut servir ses médias depuis plusieurs domaines partenaires.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headline.imageUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-[14px] bg-surface object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[14px] border border-accent/20 bg-accent/[0.08] text-2xl text-accent-cyan"
            aria-hidden="true"
          >
            ✦
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.1em] text-accent-cyan uppercase">
            {headline?.label ?? "Actualités spatiales"}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm leading-5 font-semibold text-text">
            {headline?.title ?? "Les nouvelles spatiales font une pause."}
          </h3>
          <Link
            href="/explore#nasa-highlights-title"
            className="mt-2 inline-flex min-h-8 items-center text-xs font-semibold text-accent-cyan"
          >
            Voir toutes les actualités →
          </Link>
        </div>
      </div>
    </AppCard>
  );
}

export function NasaHighlights({ compact = false }: { compact?: boolean }) {
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

  if (compact) return <CompactHighlight data={data} isUnavailable={isUnavailable} />;

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
