"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppButton, getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { PageShell } from "@/components/PageShell";
import { PermissionPanel } from "@/components/PermissionPanel";
import { QuestCard } from "@/components/QuestCard";
import { SecureContextNotice } from "@/components/SecureContextNotice";
import { getInsecureContextMessage, isSecureBrowserContext } from "@/lib/browser-support";
import { fetchNextIssVisiblePass } from "@/lib/iss";
import { generateFutureQuestSuggestions, generateQuests, type FutureQuestSuggestion } from "@/lib/quest-generator";
import { addObservation, saveActiveQuest, saveLastLocation } from "@/lib/storage";
import type { SkyQuest } from "@/lib/types";
import { getFallbackWeather, fetchWeatherNow } from "@/lib/weather";

type LoadState = "idle" | "loading" | "ready" | "error";
type FutureState = "idle" | "loading" | "ready";

type Position = {
  latitude: number;
  longitude: number;
};

function getCurrentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!isSecureBrowserContext()) {
      reject(new Error(getInsecureContextMessage("position")));
      return;
    }

    if (!("geolocation" in navigator)) {
      reject(new Error("La géolocalisation n'est pas disponible sur ce navigateur."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Position refusée. Vérifie Réglages > Safari > Position, puis réessaie."));
          return;
        }

        if (error.code === error.TIMEOUT) {
          reject(new Error("Position trop longue à obtenir. Essaie dehors, avec le GPS activé."));
          return;
        }

        reject(new Error("Position indisponible sur cet appareil pour le moment."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2 * 60 * 1000 },
    );
  });
}

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("idle");
  const [futureState, setFutureState] = useState<FutureState>("idle");
  const [quests, setQuests] = useState<SkyQuest[]>([]);
  const [futureSuggestions, setFutureSuggestions] = useState<FutureQuestSuggestion[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAllQuests, setShowAllQuests] = useState(false);

  async function handleNow() {
    setState("loading");
    setNotice(null);
    setQuests([]);
    setShowAllQuests(false);

    try {
      const coords = await getCurrentPosition();
      setPosition(coords);
      saveLastLocation(coords);

      let weatherNotice: string | null = null;
      const weather = await fetchWeatherNow(coords.latitude, coords.longitude).catch(() => {
        weatherNotice = "Météo indisponible : estimation prudente utilisée.";
        return getFallbackWeather();
      });
      const now = new Date();
      const issPass = await fetchNextIssVisiblePass({
        latitude: coords.latitude,
        longitude: coords.longitude,
        now,
      }).catch(() => null);

      const nextQuests = generateQuests({
        latitude: coords.latitude,
        longitude: coords.longitude,
        weather,
        now,
        issPass,
      });

      setQuests(nextQuests);
      setNotice(weatherNotice);
      setState("ready");
    } catch (error) {
      const fallback = generateQuests({
        latitude: null,
        longitude: null,
        weather: getFallbackWeather(),
        now: new Date(),
      });
      setQuests(fallback);
      setShowAllQuests(false);
      setNotice(error instanceof Error ? error.message : "Position indisponible : observation libre sans localisation précise.");
      setState("ready");
    }
  }

  async function handleFuturePossibilities() {
    setFutureState("loading");
    setNotice(null);
    setFutureSuggestions([]);

    try {
      const coords = await getCurrentPosition();
      setPosition(coords);
      saveLastLocation(coords);

      let weatherNotice: string | null = null;
      const weather = await fetchWeatherNow(coords.latitude, coords.longitude).catch(() => {
        weatherNotice = "Météo future indisponible : estimation prudente avec la météo actuelle.";
        return getFallbackWeather();
      });
      const now = new Date();
      const issPass = await fetchNextIssVisiblePass({
        latitude: coords.latitude,
        longitude: coords.longitude,
        now,
        horizonMinutes: 24 * 60,
      }).catch(() => null);

      setFutureSuggestions(generateFutureQuestSuggestions({
        latitude: coords.latitude,
        longitude: coords.longitude,
        weather,
        now,
        issPass,
      }));
      setNotice(weatherNotice);
      setFutureState("ready");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Position indisponible : impossible d'estimer les possibilités futures.");
      setFutureState("ready");
    }
  }

  function handleStart(quest: SkyQuest) {
    saveActiveQuest(quest);
    router.push(`/quest/${quest.id}`);
  }

  function handleLog(quest: SkyQuest, status: "seen" | "missed") {
    addObservation(quest, status, position ?? undefined);
    setNotice(status === "seen" ? "Observation ajoutée au journal." : "Résultat noté dans le journal.");
  }

  const visibleQuests = showAllQuests ? quests : quests.slice(0, 3);
  const hiddenQuestCount = Math.max(0, quests.length - visibleQuests.length);
  const isBusy = state === "loading" || futureState === "loading";

  return (
    <PageShell
      eyebrow="PWA mobile"
      title="SkyQuest"
      action={(
        <Link href="/journal" className={getAppButtonClassName({ variant: "ghost", size: "sm" })}>
          Journal
        </Link>
      )}
      contentClassName="flex flex-col justify-center py-8"
    >
        <AppCard className="relative overflow-hidden rounded-[34px] bg-surface-strong/70" padding="lg">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#7c5cff]/30 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-[#38d5ff]/15 blur-3xl" aria-hidden="true" />

          <div className="relative">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-[#cbd0ff]">
              <span className="h-2 w-2 rounded-full bg-[#63e6a4] soft-pulse" aria-hidden="true" />
              Ciel actuel, sans carte compliquée
            </div>

            <h2 className="max-w-xl text-5xl font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-6xl">
              Découvre quoi observer maintenant.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-7 text-[#c6caff]">
              Position, météo et ciel actuel pour proposer 1 à 3 mini-quêtes simples.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]">
              <AppButton size="lg" onClick={handleNow} disabled={isBusy}>
                {state === "loading" ? "Lecture du ciel..." : "Maintenant"}
              </AppButton>
              <AppButton variant="secondary" size="lg" onClick={handleFuturePossibilities} disabled={isBusy}>
                {futureState === "loading" ? "Calcul..." : "Possibilités futures"}
              </AppButton>
              <Link
                href="/journal"
                className={getAppButtonClassName({ variant: "ghost", size: "lg" })}
              >
                Journal
              </Link>
            </div>
          </div>
        </AppCard>

        <PermissionPanel />

        <section className="mt-6" aria-live="polite">
          <SecureContextNotice />
          {notice ? <ErrorState tone="info" message={notice} /> : null}
          {state === "loading" ? <LoadingState /> : null}
          {futureState === "loading" ? <LoadingState /> : null}
          {futureState === "ready" ? (
            <section className="mb-6 grid gap-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8ea0ff]">Possibilités futures</p>
                  <h3 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white">Quand revenir</h3>
                </div>
                <p className="text-right text-sm text-[#9fa6d9]">Estimation, à revérifier sur place.</p>
              </div>

              {futureSuggestions.length === 0 ? (
                <EmptyState title="Rien de fiable trouvé" message="Relance plus tard : nuages, lumière du jour ou horizon peuvent bloquer les meilleures cibles." />
              ) : (
                <div className="grid gap-3">
                  {futureSuggestions.map((suggestion) => (
                    <AppCard as="article" key={`${suggestion.quest.id}-${suggestion.availableAt}`} className="rounded-[24px]" padding="sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#38d5ff]">
                            Vers {new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(suggestion.availableAt))}
                          </p>
                          <h4 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-white">{suggestion.quest.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-[#c5caf5]">{suggestion.quest.description}</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-sm font-bold text-[#d8dcff]">
                          {suggestion.quest.visibilityScore}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-[#d8dcff]">
                        <span className="rounded-full bg-white/[0.06] px-3 py-1">{suggestion.quest.cardinalDirection ?? "Zone sombre"}</span>
                        <span className="rounded-full bg-white/[0.06] px-3 py-1">
                          {suggestion.quest.altitude !== null ? `${Math.round(suggestion.quest.altitude)}°` : "Pas de cible précise"}
                        </span>
                      </div>
                    </AppCard>
                  ))}
                </div>
              )}
            </section>
          ) : null}
          {state === "ready" && quests.length === 0 ? (
            <EmptyState title="Aucune quête prête" message="Tu peux relancer maintenant ou tenter une observation libre du ciel." />
          ) : null}
          {state === "ready" && quests.length > 0 ? (
            <div className="grid gap-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8ea0ff]">Quêtes proposées</p>
                  <h3 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white">À tenter maintenant</h3>
                </div>
                <p className="text-right text-sm text-[#9fa6d9]">Jamais garanti, toujours approximatif.</p>
              </div>
              {visibleQuests.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  onStart={handleStart}
                  onSeen={(nextQuest) => handleLog(nextQuest, "seen")}
                  onMissed={(nextQuest) => handleLog(nextQuest, "missed")}
                />
              ))}
              {quests.length > 3 ? (
                <AppButton variant="secondary" onClick={() => setShowAllQuests((current) => !current)}>
                  {showAllQuests ? "Masquer les autres" : `Afficher ${hiddenQuestCount} autre${hiddenQuestCount > 1 ? "s" : ""}`}
                </AppButton>
              ) : null}
            </div>
          ) : null}
        </section>
    </PageShell>
  );
}
