"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppButton, getAppButtonClassName } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { PageShell } from "@/components/PageShell";
import { PermissionPanel } from "@/components/PermissionPanel";
import { QuestCard } from "@/components/QuestCard";
import { ProgressFeedback } from "@/components/ProgressFeedback";
import { SecureContextNotice } from "@/components/SecureContextNotice";
import { getInsecureContextMessage, isSecureBrowserContext } from "@/lib/browser-support";
import { fetchNextIssVisiblePass } from "@/lib/iss";
import { isPopunderAdOnCooldown, triggerPopunderAd } from "@/lib/popunder-ad";
import { generateFutureQuestSuggestions, generateQuests, type FutureQuestSuggestion } from "@/lib/quest-generator";
import { addObservation, saveActiveQuest, saveLastLocation } from "@/lib/storage";
import type { ProgressReward, SkyQuest } from "@/lib/types";
import { getFallbackWeather, fetchWeatherNow } from "@/lib/weather";

type LoadState = "idle" | "loading" | "ready";
type FutureState = "idle" | "loading" | "ready";
type AdAction = "now" | "future";

type Position = {
  latitude: number;
  longitude: number;
};

type HomeSnapshot = {
  state: LoadState;
  futureState: FutureState;
  quests: SkyQuest[];
  futureSuggestions: FutureQuestSuggestion[];
  position: Position | null;
  notice: string | null;
  savedAt: number;
};

const HOME_SNAPSHOT_KEY = "skyquest:home-snapshot";
const HOME_SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;

function getCurrentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!isSecureBrowserContext()) {
      reject(new Error(getInsecureContextMessage("position")));
      return;
    }

    if (!("geolocation" in navigator)) {
      reject(new Error("La geolocalisation n'est pas disponible sur ce navigateur."));
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
          reject(new Error("Position refusee. Verifie Reglages > Safari > Position, puis reessaie."));
          return;
        }

        if (error.code === error.TIMEOUT) {
          reject(new Error("Position trop longue a obtenir. Essaie dehors, avec le GPS active."));
          return;
        }

        reject(new Error("Position indisponible sur cet appareil pour le moment."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2 * 60 * 1000 },
    );
  });
}

function readHomeSnapshot(): HomeSnapshot | null {
  try {
    const value = window.sessionStorage.getItem(HOME_SNAPSHOT_KEY);
    if (!value) {
      return null;
    }

    const snapshot = JSON.parse(value) as HomeSnapshot;
    if (Date.now() - snapshot.savedAt > HOME_SNAPSHOT_MAX_AGE_MS) {
      window.sessionStorage.removeItem(HOME_SNAPSHOT_KEY);
      return null;
    }

    return snapshot;
  } catch {
    return null;
  }
}

function saveHomeSnapshot(snapshot: Omit<HomeSnapshot, "savedAt">) {
  try {
    window.sessionStorage.setItem(HOME_SNAPSHOT_KEY, JSON.stringify({
      ...snapshot,
      savedAt: Date.now(),
    }));
  } catch {
    // The app still works without state restore.
  }
}

function AdConsentModal({
  action,
  onClose,
  onConfirm,
  isBusy,
}: {
  action: AdAction;
  onClose: () => void;
  onConfirm: () => void;
  isBusy: boolean;
}) {
  const title = action === "now" ? "Avant de lire le ciel" : "Avant de calculer les possibilites";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#03050a]/80 px-3 pb-3 backdrop-blur-md sm:items-center sm:pb-0" role="dialog" aria-modal="true" aria-labelledby="ad-modal-title">
      <AppCard className="w-full max-w-md rounded-[26px]" padding="lg">
        <div className="mb-6 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <p className="premium-kicker">Avant de continuer</p>
        <h2 id="ad-modal-title" className="mt-2 text-[1.85rem] font-bold tracking-[-0.045em] text-white">
          {title}
        </h2>
        <p className="mt-3 text-base leading-7 text-muted">
          On affiche une pub seulement apres ton accord. Ensuite SkyQuest prepare les quetes et garde le resultat si tu reviens sur l&apos;accueil.
        </p>
        <div className="mt-6 grid gap-3">
          <AppButton onClick={onConfirm} disabled={isBusy} fullWidth>
            {isBusy ? "Affichage de la pub..." : "Regarder la pub"}
          </AppButton>
          <AppButton variant="ghost" onClick={onClose} disabled={isBusy} fullWidth>
            Pas maintenant
          </AppButton>
        </div>
      </AppCard>
    </div>
  );
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
  const [adAction, setAdAction] = useState<AdAction | null>(null);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [lastReward, setLastReward] = useState<ProgressReward | null>(null);

  useEffect(() => {
    const snapshot = readHomeSnapshot();
    if (!snapshot) {
      return;
    }

    setState(snapshot.state);
    setFutureState(snapshot.futureState);
    setQuests(snapshot.quests);
    setFutureSuggestions(snapshot.futureSuggestions);
    setPosition(snapshot.position);
    setNotice(snapshot.notice);
  }, []);

  function persistSnapshot(nextSnapshot?: Partial<Omit<HomeSnapshot, "savedAt">>) {
    saveHomeSnapshot({
      state,
      futureState,
      quests,
      futureSuggestions,
      position,
      notice,
      ...nextSnapshot,
    });
  }

  async function runNow() {
    setState("loading");
    setNotice(null);
    setQuests([]);
    setShowAllQuests(false);
    setLastReward(null);

    try {
      const coords = await getCurrentPosition();
      setPosition(coords);
      saveLastLocation(coords);

      let weatherNotice: string | null = null;
      const weather = await fetchWeatherNow(coords.latitude, coords.longitude).catch(() => {
        weatherNotice = "Meteo indisponible : estimation prudente utilisee.";
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
      persistSnapshot({
        state: "ready",
        quests: nextQuests,
        position: coords,
        notice: weatherNotice,
      });
    } catch (error) {
      const fallback = generateQuests({
        latitude: null,
        longitude: null,
        weather: getFallbackWeather(),
        now: new Date(),
      });
      const nextNotice = error instanceof Error ? error.message : "Position indisponible : observation libre sans localisation precise.";

      setQuests(fallback);
      setShowAllQuests(false);
      setNotice(nextNotice);
      setState("ready");
      persistSnapshot({
        state: "ready",
        quests: fallback,
        notice: nextNotice,
      });
    }
  }

  async function runFuturePossibilities() {
    setFutureState("loading");
    setNotice(null);
    setFutureSuggestions([]);

    try {
      const coords = await getCurrentPosition();
      setPosition(coords);
      saveLastLocation(coords);

      let weatherNotice: string | null = null;
      const weather = await fetchWeatherNow(coords.latitude, coords.longitude).catch(() => {
        weatherNotice = "Meteo future indisponible : estimation prudente avec la meteo actuelle.";
        return getFallbackWeather();
      });
      const now = new Date();
      const issPass = await fetchNextIssVisiblePass({
        latitude: coords.latitude,
        longitude: coords.longitude,
        now,
        horizonMinutes: 24 * 60,
      }).catch(() => null);
      const nextSuggestions = generateFutureQuestSuggestions({
        latitude: coords.latitude,
        longitude: coords.longitude,
        weather,
        now,
        issPass,
      });

      setFutureSuggestions(nextSuggestions);
      setNotice(weatherNotice);
      setFutureState("ready");
      persistSnapshot({
        futureState: "ready",
        futureSuggestions: nextSuggestions,
        position: coords,
        notice: weatherNotice,
      });
    } catch (error) {
      const nextNotice = error instanceof Error ? error.message : "Position indisponible : impossible d'estimer les possibilites futures.";

      setNotice(nextNotice);
      setFutureState("ready");
      persistSnapshot({
        futureState: "ready",
        futureSuggestions: [],
        notice: nextNotice,
      });
    }
  }

  function handleNow() {
    if (isPopunderAdOnCooldown()) {
      void runNow();
      return;
    }

    setAdAction("now");
  }

  function handleFuturePossibilities() {
    if (isPopunderAdOnCooldown()) {
      void runFuturePossibilities();
      return;
    }

    setAdAction("future");
  }

  async function handleAdConfirm() {
    const nextAction = adAction;
    if (!nextAction || isAdLoading) {
      return;
    }

    setIsAdLoading(true);
    await triggerPopunderAd();
    setIsAdLoading(false);
    setAdAction(null);

    if (nextAction === "future") {
      void runFuturePossibilities();
      return;
    }

    void runNow();
  }

  function handleStart(quest: SkyQuest) {
    saveActiveQuest(quest);
    router.push(`/quest/${quest.id}`);
  }

  function handleLog(quest: SkyQuest, status: "seen" | "missed") {
    const result = addObservation(quest, status, position ?? undefined);
    setLastReward(result.reward);
    const nextNotice = status === "seen" ? "Observation ajoutee au journal." : "Resultat note dans le journal.";
    setNotice(nextNotice);
    persistSnapshot({ notice: nextNotice });
  }

  const visibleQuests = showAllQuests ? quests : quests.slice(0, 3);
  const hiddenQuestCount = Math.max(0, quests.length - visibleQuests.length);
  const isBusy = state === "loading" || futureState === "loading" || isAdLoading;

  return (
    <PageShell
      eyebrow="Guide du ciel"
      title="SkyQuest"
      action={(
        <Link href="/journal" className={getAppButtonClassName({ variant: "ghost", size: "sm" })}>
          Journal
        </Link>
      )}
      contentClassName="flex flex-col py-5 sm:py-8"
    >
      {adAction ? (
        <AdConsentModal
          action={adAction}
          onClose={() => setAdAction(null)}
          onConfirm={handleAdConfirm}
          isBusy={isBusy}
        />
      ) : null}

      <AppCard className="relative overflow-hidden rounded-[28px] bg-[#0e1321]/90" padding="lg">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-cyan/35 to-transparent" aria-hidden="true" />
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-accent/15" aria-hidden="true" />
        <div className="absolute -right-9 -top-12 h-40 w-40 rounded-full border border-white/[0.06]" aria-hidden="true" />

        <div className="relative">
          <div className="mb-9 flex items-center gap-3 text-sm text-muted">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-25" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span>Ciel actuel</span>
            <span className="h-1 w-1 rounded-full bg-faint" />
            <span>Conseils simples</span>
          </div>

          <h2 className="max-w-[12ch] text-[2.65rem] font-semibold leading-[0.98] tracking-[-0.062em] text-white sm:text-[3.65rem]">
            Le ciel a quelque chose à te montrer.
          </h2>
          <p className="mt-5 max-w-lg text-[1.05rem] leading-7 text-muted">
            Des observations choisies selon ta position, la météo et ce qui est réellement visible.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <AppButton size="lg" onClick={handleNow} disabled={isBusy}>
              {state === "loading" ? "Lecture du ciel..." : "Maintenant"}
            </AppButton>
            <AppButton variant="secondary" size="lg" onClick={handleFuturePossibilities} disabled={isBusy}>
              {futureState === "loading" ? "Calcul..." : "Possibilites futures"}
            </AppButton>
          </div>
          <div className="mt-6 flex items-center gap-3 border-t border-white/[0.08] pt-5 text-xs leading-5 text-faint">
            <span className="shrink-0 rounded-md border border-white/[0.08] px-2 py-1 font-semibold text-muted">Local</span>
            Position et journal restent sur ton appareil.
          </div>
        </div>
      </AppCard>

      <PermissionPanel />

      <section className="mt-6" aria-live="polite">
        <SecureContextNotice />
        {lastReward ? <div className="mb-4"><ProgressFeedback reward={lastReward} /></div> : null}
        {notice ? <ErrorState tone="info" message={notice} /> : null}
        {state === "loading" ? <LoadingState /> : null}
        {futureState === "loading" ? <LoadingState /> : null}
        {futureState === "ready" ? (
          <section className="mb-6 grid gap-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="premium-kicker">Possibilites futures</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">Quand revenir</h3>
              </div>
              <p className="text-right text-sm text-faint">Estimation, a reverifier sur place.</p>
            </div>

            {futureSuggestions.length === 0 ? (
              <EmptyState title="Rien de fiable trouve" message="Relance plus tard : nuages, lumiere du jour ou horizon peuvent bloquer les meilleures cibles." />
            ) : (
              <div className="grid gap-3">
                {futureSuggestions.map((suggestion) => (
                  <AppCard as="article" key={`${suggestion.quest.id}-${suggestion.availableAt}`} className="rounded-[22px]" padding="sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="premium-kicker">
                          Vers {new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(suggestion.availableAt))}
                        </p>
                        <h4 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-white">{suggestion.quest.title}</h4>
                        <p className="mt-2 text-sm leading-6 text-muted">{suggestion.quest.description}</p>
                      </div>
                      <span className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm font-bold text-muted">
                        Conditions {suggestion.quest.visibilityScore}/100
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-muted">
                      <span className="rounded-lg bg-white/[0.045] px-3 py-1">{suggestion.quest.cardinalDirection ?? "Zone sombre"}</span>
                      <span className="rounded-lg bg-white/[0.045] px-3 py-1">
                        {suggestion.quest.altitude !== null ? `${Math.round(suggestion.quest.altitude)} deg` : "Pas de cible precise"}
                      </span>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}
          </section>
        ) : null}
        {state === "ready" && quests.length === 0 ? (
          <EmptyState title="Aucune quete prete" message="Tu peux relancer maintenant ou tenter une observation libre du ciel." />
        ) : null}
        {state === "ready" && quests.length > 0 ? (
          <div className="grid gap-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="premium-kicker">Quetes proposees</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">A tenter maintenant</h3>
              </div>
              <p className="text-right text-sm text-faint">Jamais garanti, toujours approximatif.</p>
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
