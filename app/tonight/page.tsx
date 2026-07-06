"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { PageShell } from "@/components/PageShell";
import { UpcomingSkyEvents } from "@/components/UpcomingSkyEvents";
import { getCurrentPosition } from "@/lib/browser-support";
import { runSkyAnalysis } from "@/lib/sky-analysis";
import {
  BEST_SKY_WINDOW_TTL_MS,
  ESTIMATED_BEST_SKY_WINDOW_TTL_MS,
  isBestSkyWindowFresh,
} from "@/lib/sky-window-freshness";
import {
  getBestSkyWindowStatus,
  getLastLocation,
  saveBestSkyWindow,
  saveLastLocation,
} from "@/lib/storage";
import type { BestSkyWindow, FogRisk } from "@/lib/types";
import { scheduleSkyWindowReminder } from "@/lib/push-client";
import {
  formatVisibilityScore,
  formatVisibilityScoreForAccessibility,
  normalizeVisibilityScore,
} from "@/lib/visibility";

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
  const [isSchedulingReminder, setIsSchedulingReminder] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const stored = getBestSkyWindowStatus();
    setSkyWindow(stored.window);
    if (!stored.window && stored.reason !== "missing") {
      setNotice("Ton précédent créneau a expiré. Recalcule les conditions avant de sortir.");
    }
  }, []);

  useEffect(() => {
    if (!skyWindow) return;

    const revalidateSkyWindow = () => {
      const stored = getBestSkyWindowStatus(new Date());
      setSkyWindow(stored.window);
      if (!stored.window) {
        setIsSchedulingReminder(false);
        setNotice("Ton précédent créneau a expiré. Recalcule les conditions avant de sortir.");
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") revalidateSkyWindow();
    };
    const endsAtMs = new Date(skyWindow.endsAt).getTime();
    const generatedAtMs = new Date(skyWindow.generatedAt).getTime();
    const ttlMs = skyWindow.isEstimated ? ESTIMATED_BEST_SKY_WINDOW_TTL_MS : BEST_SKY_WINDOW_TTL_MS;
    const invalidAtMs = Math.min(endsAtMs, generatedAtMs + ttlMs);
    const timeoutId = window.setTimeout(
      revalidateSkyWindow,
      Math.max(0, invalidAtMs - Date.now() + 25),
    );

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", revalidateSkyWindow);
    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", revalidateSkyWindow);
    };
  }, [skyWindow]);

  const bestHour = useMemo(() => {
    if (!skyWindow) return null;
    return skyWindow.hours.reduce((best, hour) => (hour.score > best.score ? hour : best));
  }, [skyWindow]);

  async function calculate() {
    if (isLoading) return;
    setIsLoading(true);
    setNotice(null);
    const publishSkyWindow = (result: BestSkyWindow) => {
      saveBestSkyWindow(result);
      setSkyWindow(result);
    };
    try {
      const position = await getCurrentPosition();
      saveLastLocation(position);
      const update = await runSkyAnalysis({ coords: position });
      if (!update.analysis.bestSkyWindow) throw new Error("Best sky window unavailable");
      publishSkyWindow(update.analysis.bestSkyWindow);
      setNotice(update.weatherNotice);
    } catch (error) {
      const storedLocation = getLastLocation();
      if (storedLocation) {
        try {
          const update = await runSkyAnalysis({ coords: storedLocation });
          if (!update.analysis.bestSkyWindow) throw new Error("Best sky window unavailable");
          publishSkyWindow(update.analysis.bestSkyWindow);
          setNotice(
            [
              "Position actuelle indisponible : estimation prudente depuis ta dernière zone connue.",
              update.weatherNotice,
            ]
              .filter(Boolean)
              .join(" "),
          );
        } catch {
          setNotice(
            "Position actuelle indisponible. Reviens sur Maintenant quand la géolocalisation répondra.",
          );
        }
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

  async function handleReminder() {
    if (!skyWindow || isSchedulingReminder) return;
    const now = new Date();
    if (!isBestSkyWindowFresh(skyWindow, now)) {
      getBestSkyWindowStatus(now);
      setSkyWindow(null);
      setNotice("Ton précédent créneau a expiré. Recalcule les conditions avant de sortir.");
      return;
    }
    const startsAt = new Date(skyWindow.startsAt);
    const reminderAt = new Date(Math.max(now.getTime(), startsAt.getTime() - 15 * 60 * 1_000));
    setIsSchedulingReminder(true);
    setNotice(null);
    const scheduled = await scheduleSkyWindowReminder({
      reminderAt: reminderAt.toISOString(),
      windowStartsAt: skyWindow.startsAt,
      windowEndsAt: skyWindow.endsAt,
      target: skyWindow.bestTargets[0],
      score: skyWindow.score,
      location: getLastLocation(),
    });
    setIsSchedulingReminder(false);
    setNotice(
      scheduled
        ? `Rappel prévu vers ${formatTime(reminderAt.toISOString(), skyWindow.timezone)}. Un toucher relancera l’analyse du ciel.`
        : "Le rappel n’a pas pu être activé. Vérifie que les notifications sont autorisées sur cet appareil.",
    );
  }

  return (
    <PageShell eyebrow="Prévision" title="Plus tard" contentClassName="pb-4">
      {skyWindow ? (
        <>
          <AppCard as="section" variant="glass" padding="lg" className="relative overflow-hidden">
            <div className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="premium-kicker">Meilleur moment sur 24 h</p>
                <p className="mt-2 text-sm font-semibold text-text">
                  {scoreLabel(skyWindow.score)}
                </p>
              </div>
              <div
                className="flex shrink-0 items-baseline rounded-full border border-accent/25 bg-accent/[0.09] px-3 py-2 text-accent-cyan"
                aria-label={formatVisibilityScoreForAccessibility(skyWindow.score)}
              >
                <strong className="text-xl leading-none">
                  {normalizeVisibilityScore(skyWindow.score)}
                </strong>
                <span className="ml-0.5 text-[0.65rem] text-muted">/100</span>
              </div>
            </div>
            <h2 className="relative mt-5 font-[Georgia,'Times_New_Roman',serif] text-[1.8rem] leading-tight font-normal text-text sm:text-[2rem]">
              Le meilleur créneau se situe entre{" "}
              <span className="text-accent-cyan">
                {formatTime(skyWindow.startsAt, skyWindow.timezone)} et{" "}
                {formatTime(skyWindow.endsAt, skyWindow.timezone)}
              </span>
            </h2>
            <p className="relative mt-3 text-sm leading-6 text-muted">
              {formatVisibilityScore(skyWindow.score)} pour choisir quand sortir, sans garantie
              d’observation.
            </p>
            <div className="relative mt-5 border-t border-white/[0.07] pt-4">
              <p className="text-xs font-semibold tracking-[0.08em] text-faint uppercase">
                À regarder pendant ce créneau
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(skyWindow.bestTargets.length
                  ? skyWindow.bestTargets
                  : ["Observation libre", "Horizon dégagé"]
                ).map((target) => (
                  <span
                    key={target}
                    className="rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-text"
                  >
                    {target}
                  </span>
                ))}
              </div>
            </div>
          </AppCard>

          <AppCard as="section" variant="solid" padding="none" className="mt-3 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
              <div className="min-w-0 px-2 py-4 text-center">
                <p className="text-lg font-semibold text-text">
                  {Math.round(bestHour?.cloudCover ?? 0)}%
                </p>
                <p className="mt-1 text-[0.65rem] tracking-wide text-faint uppercase">Nuages</p>
              </div>
              <div className="min-w-0 px-2 py-4 text-center">
                <p className="text-lg font-semibold text-text">
                  {Math.round(bestHour?.relativeHumidity ?? 0)}%
                </p>
                <p className="mt-1 text-[0.65rem] tracking-wide text-faint uppercase">Humidité</p>
              </div>
              <div className="min-w-0 px-2 py-4 text-center">
                <p className="text-lg font-semibold text-text">
                  {skyWindow.moonIlluminationPercent}%
                </p>
                <p className="mt-1 text-[0.65rem] tracking-wide text-faint uppercase">Lune</p>
              </div>
            </div>
          </AppCard>

          <AppCard as="section" variant="glass" padding="md" className="mt-3">
            <p className="premium-kicker">Préparer l’observation</p>
            <h2 className="mt-1 text-base font-semibold text-text">Que veux-tu faire ?</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Reçois un rappel environ 15 minutes avant, ou actualise les conditions maintenant.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {isBestSkyWindowFresh(skyWindow) ? (
                <AppButton
                  fullWidth
                  isLoading={isSchedulingReminder}
                  onClick={() => void handleReminder()}
                >
                  Me prévenir
                </AppButton>
              ) : null}
              <AppButton
                variant={isBestSkyWindowFresh(skyWindow) ? "secondary" : "primary"}
                fullWidth
                isLoading={isLoading}
                onClick={() => void calculate()}
              >
                Actualiser le créneau
              </AppButton>
            </div>
            <p className="mt-3 text-xs leading-5 text-faint">
              Ta position est demandée seulement lorsque tu actualises.
            </p>
          </AppCard>

          {notice ? (
            <AppCard
              variant="subtle"
              padding="sm"
              className="mt-3 border-warning/20 bg-warning/[0.06] text-sm leading-5 text-muted"
              role="status"
            >
              <p>{notice}</p>
            </AppCard>
          ) : null}

          <section className="mt-8" aria-labelledby="hourly-title">
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
              <span className="shrink-0 text-xs text-faint">Glisse →</span>
            </div>
            <div className="-mx-5 mt-4 flex snap-x gap-2 overflow-x-auto px-5 pb-3">
              {skyWindow.hours.map((hour) => {
                const active = hour.date === bestHour?.date;
                return (
                  <AppCard
                    as="article"
                    variant="solid"
                    padding="sm"
                    key={hour.date}
                    className={`relative min-w-[104px] snap-start text-center ${active ? "border-accent/60 bg-accent/[0.12]" : ""}`}
                    aria-label={`${formatTime(hour.date, skyWindow.timezone)}. ${formatVisibilityScoreForAccessibility(hour.score)}`}
                  >
                    <p className="text-xs font-semibold text-muted">
                      {formatTime(hour.date, skyWindow.timezone)}
                    </p>
                    {active ? (
                      <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-accent-cyan shadow-[0_0_8px_var(--accent-cyan)]" />
                    ) : null}
                    <p
                      className={`mt-3 flex items-baseline justify-center ${active ? "text-accent-cyan" : "text-text"}`}
                    >
                      <strong className="text-[1.15rem] leading-none tracking-[-0.04em]">
                        {formatVisibilityScore(hour.score, "compact")}
                      </strong>
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
                  </AppCard>
                );
              })}
            </div>
          </section>

          <AppCard as="section" padding="md" className="mt-4">
            <p className="premium-kicker">Pourquoi ce créneau</p>
            <h2 className="mt-1 text-base font-semibold text-text">
              Les trois facteurs principaux
            </h2>
            <dl className="mt-4 divide-y divide-white/[0.06]">
              <div className="flex items-start justify-between gap-4 py-3 first:pt-0">
                <dt className="text-sm text-muted">Obscurité</dt>
                <dd className="max-w-[62%] text-right text-sm font-semibold text-text">
                  {bestHour?.isAstronomicalDark
                    ? "Nuit astronomique"
                    : "Crépuscule ou nuit partielle"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-3">
                <dt className="text-sm text-muted">Brume</dt>
                <dd className="text-right text-sm font-semibold text-text">
                  Risque {bestHour ? FOG_LABELS[bestHour.fogRisk] : "inconnu"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 pt-3">
                <dt className="text-sm text-muted">Lune</dt>
                <dd className="max-w-[62%] text-right text-sm font-semibold text-text">
                  {skyWindow.moonPhaseLabel} · {skyWindow.moonIlluminationPercent}%
                </dd>
              </div>
            </dl>
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

      {notice && !skyWindow ? (
        <AppCard
          variant="subtle"
          padding="sm"
          className="mt-4 border-warning/20 bg-warning/[0.06] text-sm leading-5 text-muted"
          role="status"
        >
          <p>{notice}</p>
        </AppCard>
      ) : null}
      {!skyWindow ? (
        <>
          <AppButton
            fullWidth
            className="mt-4"
            isLoading={isLoading}
            onClick={() => void calculate()}
          >
            Calculer mon créneau
          </AppButton>
          <p className="mt-2 text-center text-xs leading-5 text-faint">
            La position est demandée uniquement après ce clic.
          </p>
        </>
      ) : null}

      <UpcomingSkyEvents />
    </PageShell>
  );
}
