"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { PageShell } from "@/components/PageShell";
import { UpcomingSkyEvents } from "@/components/UpcomingSkyEvents";
import { getCurrentPosition } from "@/lib/browser-support";
import { calculateBestSkyWindow } from "@/lib/sky-window";
import {
  getBestSkyWindow,
  getLastLocation,
  saveBestSkyWindow,
  saveLastLocation,
} from "@/lib/storage";
import type { BestSkyWindow, FogRisk } from "@/lib/types";
import { fetchWeatherForecast, getFallbackWeatherForecast } from "@/lib/weather";

const FOG_LABELS: Record<FogRisk, string> = {
  low: "faible",
  moderate: "modéré",
  high: "élevé",
};

function formatTime(date: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone === "auto" ? undefined : timezone,
    }).format(new Date(date));
  } catch {
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(
      new Date(date),
    );
  }
}

function scoreLabel(score: number): string {
  if (score >= 75) return "Très prometteur";
  if (score >= 60) return "Bon créneau";
  if (score >= 50) return "Tentable";
  return "Conditions fragiles";
}

export default function TonightPage() {
  const [skyWindow, setSkyWindow] = useState<BestSkyWindow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setSkyWindow(getBestSkyWindow()), []);

  const bestHour = useMemo(() => {
    if (!skyWindow) return null;
    return skyWindow.hours.reduce((best, hour) => (hour.score > best.score ? hour : best));
  }, [skyWindow]);

  async function calculate() {
    if (isLoading) return;
    setIsLoading(true);
    setNotice(null);
    try {
      const position = await getCurrentPosition();
      saveLastLocation(position);
      let usedFallback = false;
      const forecast = await fetchWeatherForecast(position.latitude, position.longitude, 24).catch(
        () => {
          usedFallback = true;
          return getFallbackWeatherForecast();
        },
      );
      const result = calculateBestSkyWindow({
        latitude: position.latitude,
        longitude: position.longitude,
        forecast,
      });
      saveBestSkyWindow(result);
      setSkyWindow(result);
      if (usedFallback) {
        setNotice(
          "Prévision météo indisponible : estimation prudente, à revérifier avant de sortir.",
        );
      }
    } catch (error) {
      const storedLocation = getLastLocation();
      if (storedLocation) {
        const result = calculateBestSkyWindow({
          latitude: storedLocation.latitude,
          longitude: storedLocation.longitude,
          forecast: getFallbackWeatherForecast(),
        });
        saveBestSkyWindow(result);
        setSkyWindow(result);
        setNotice(
          "Position actuelle indisponible : estimation prudente depuis ta dernière zone connue.",
        );
      } else {
        setNotice(
          error instanceof Error
            ? error.message
            : "Impossible de lire ta position. Tu peux réessayer plus tard.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageShell eyebrow="Prévision" title="Ce soir" contentClassName="pb-4">
      {skyWindow ? (
        <>
          <AppCard as="section" variant="glass" padding="lg" className="relative overflow-hidden">
            <div className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl" />
            <p className="premium-kicker">Meilleur moment sur 24 h</p>
            <h2 className="relative mt-3 font-[Georgia,'Times_New_Roman',serif] text-[2rem] leading-tight font-normal text-text">
              {skyWindow.score >= 50 ? "Va dehors" : "Si tu veux tenter"} entre{" "}
              <span className="text-accent-cyan">
                {formatTime(skyWindow.startsAt, skyWindow.timezone)} et{" "}
                {formatTime(skyWindow.endsAt, skyWindow.timezone)}
              </span>
            </h2>
            <p className="relative mt-3 text-sm leading-6 text-muted">
              {scoreLabel(skyWindow.score)} · indice {skyWindow.score}/100. Ce score guide ton
              choix, il ne garantit jamais une observation.
            </p>
            <div className="relative mt-5 border-t border-white/[0.07] pt-4">
              <p className="text-xs font-semibold tracking-[0.08em] text-faint uppercase">
                Meilleures cibles
              </p>
              <p className="mt-2 text-base text-text">
                {skyWindow.bestTargets.length
                  ? skyWindow.bestTargets.join(" · ")
                  : "Observation libre · horizon dégagé"}
              </p>
            </div>
          </AppCard>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <AppCard padding="sm" className="text-center">
              <p className="text-lg font-semibold text-text">
                {Math.round(bestHour?.cloudCover ?? 0)}%
              </p>
              <p className="mt-1 text-[0.68rem] text-faint uppercase">Nuages</p>
            </AppCard>
            <AppCard padding="sm" className="text-center">
              <p className="text-lg font-semibold text-text">
                {Math.round(bestHour?.relativeHumidity ?? 0)}%
              </p>
              <p className="mt-1 text-[0.68rem] text-faint uppercase">Humidité</p>
            </AppCard>
            <AppCard padding="sm" className="text-center">
              <p className="text-lg font-semibold text-text">
                {skyWindow.moonIlluminationPercent}%
              </p>
              <p className="mt-1 text-[0.68rem] text-faint uppercase">Lune</p>
            </AppCard>
          </div>

          <section className="mt-7" aria-labelledby="hourly-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="premium-kicker">Prévision heure par heure</p>
                <h2
                  id="hourly-title"
                  className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-xl text-text"
                >
                  Les prochaines 24 heures
                </h2>
              </div>
              <span className="text-xs text-faint">Glisse →</span>
            </div>
            <div className="-mx-5 mt-4 flex snap-x gap-2 overflow-x-auto px-5 pb-3">
              {skyWindow.hours.map((hour) => {
                const active = hour.date === bestHour?.date;
                return (
                  <article
                    key={hour.date}
                    className={`min-w-[86px] snap-start rounded-[18px] border p-3 text-center ${active ? "border-accent/60 bg-accent/[0.12]" : "border-white/[0.07] bg-surface-strong"}`}
                  >
                    <p className="text-xs font-semibold text-muted">
                      {formatTime(hour.date, skyWindow.timezone)}
                    </p>
                    <p
                      className={`mt-3 text-2xl font-semibold ${active ? "text-accent-cyan" : "text-text"}`}
                    >
                      {hour.score}
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${hour.score}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[0.65rem] text-faint">
                      ☁ {Math.round(hour.cloudCover)}%
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <AppCard as="section" padding="md" className="mt-4">
            <h2 className="text-sm font-semibold text-text">Ce qui pèse dans le choix</h2>
            <div className="mt-3 grid gap-2 text-sm text-muted">
              <p>
                Obscurité :{" "}
                {bestHour?.isAstronomicalDark
                  ? "nuit astronomique"
                  : "crépuscule ou nuit partielle"}
              </p>
              <p>Brume : risque {bestHour ? FOG_LABELS[bestHour.fogRisk] : "inconnu"}</p>
              <p>
                Lune : {skyWindow.moonPhaseLabel.toLowerCase()} ({skyWindow.moonIlluminationPercent}
                % éclairée)
              </p>
            </div>
          </AppCard>
        </>
      ) : (
        <AppCard as="section" variant="glass" padding="lg" className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/25 bg-accent/[0.09] text-2xl text-accent-cyan">
            ✦
          </div>
          <h2 className="mt-5 font-[Georgia,'Times_New_Roman',serif] text-2xl text-text">
            Quand vaut-il vraiment la peine de sortir ?
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            SkyQuest compare météo, obscurité, Lune et cibles visibles pendant 24 heures.
          </p>
        </AppCard>
      )}

      {notice ? (
        <p
          className="mt-4 rounded-[16px] border border-warning/20 bg-warning/[0.06] p-3 text-sm leading-5 text-muted"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <AppButton fullWidth className="mt-4" isLoading={isLoading} onClick={() => void calculate()}>
        {skyWindow ? "Actualiser mon créneau" : "Calculer ma soirée"}
      </AppButton>
      <p className="mt-2 text-center text-xs leading-5 text-faint">
        La position est demandée uniquement après ce clic.
      </p>

      <UpcomingSkyEvents />
    </PageShell>
  );
}
