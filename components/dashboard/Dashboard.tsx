"use client";

/**
 * Dashboard
 *
 * Orchestre le parcours « Maintenant » de la PWA installée : permission GPS, météo,
 * passage ISS optionnel, génération des quêtes, cache de l'analyse et navigation vers
 * le guidage. L'écran affiche toutes les quêtes fiables du moment, classées par pertinence.
 *
 * Important :
 * - le GPS doit rester déclenché par une action utilisateur ;
 * - une panne météo ou ISS ne doit jamais bloquer les autres quêtes ;
 * - une analyse relue du cache peut être affichée, mais son guidage reste verrouillé jusqu'à
 *   une nouvelle analyse afin de ne pas utiliser silencieusement une position périmée ;
 * - l'interface conserve le classement par pertinence et affiche toutes les quêtes générées.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { AppButton } from "@/components/AppButton";
import { AppCard, getAppCardClassName } from "@/components/AppCard";
import { fetchAirQualityNow, getAirTransparencyEstimate } from "@/lib/air-quality";
import { AppHeader } from "@/components/AppHeader";
import { BestSkyWindowCard } from "@/components/BestSkyWindowCard";
import { Onboarding } from "@/components/Onboarding";
import { VisibilityExplanationContent } from "@/components/VisibilityExplanationCard";
import { getCurrentPosition, type GeoPosition } from "@/lib/browser-support";
import { haptic } from "@/lib/haptics";
import { fetchNextIssVisiblePass, isIssQuestGuidable } from "@/lib/iss";
import { fetchTrackedSatellitePasses } from "@/lib/satellites";
import { fetchLightPollutionEstimate } from "@/lib/light-pollution-client";
import type { LightPollutionEstimate } from "@/lib/light-pollution";
import { fetchLightingPracticeEstimate } from "@/lib/lighting-practices-client";
import type { LightingPracticeEstimate } from "@/lib/lighting-practices";
import { selectEveningQuest } from "@/lib/evening-quest";
import { getLocalNightKey } from "@/lib/progression";
import { rankQuestsForRecommendation } from "@/lib/quest-ranking";
import { calculateBestSkyWindow } from "@/lib/sky-window";
import { isBestSkyWindowFresh } from "@/lib/sky-window-freshness";
import { generateQuests } from "@/lib/quest-generator";
import { isGeneratedAtFresh, isQuestFresh, SKY_DATA_TTL_MS } from "@/lib/quest-freshness";
import {
  clearExpiredEveningQuestAssignment,
  getOnboardingCompleted,
  getLastLocation,
  getObservations,
  getProgressProfile,
  saveActiveQuest,
  saveBestSkyWindow,
  saveEveningQuestAssignment,
  saveLastLocation,
  setOnboardingCompleted,
} from "@/lib/storage";
import type {
  AirQualityNow,
  BestSkyWindow,
  EveningQuestAssignment,
  Observation,
  SkyQuest,
  WeatherNow,
} from "@/lib/types";
import {
  formatVisibilityScore,
  formatVisibilityScoreForAccessibility,
  normalizeVisibilityScore,
} from "@/lib/visibility";
import {
  fetchWeatherForecast,
  fetchWeatherNow,
  getFallbackWeather,
  getFallbackWeatherForecast,
} from "@/lib/weather";

type LoadState = "idle" | "loading" | "ready";

const DASHBOARD_ANALYSIS_KEY = "skyquest.dashboard-analysis.v1";
let unlockedAnalysisForRuntime: number | null = null;

type DashboardAnalysis = {
  savedAt: number;
  generatedAt: string;
  position: GeoPosition;
  weather: WeatherNow;
  quests: SkyQuest[];
  bestSkyWindow?: BestSkyWindow;
  lightPollution?: LightPollutionEstimate;
  lightingPractice?: LightingPracticeEstimate;
  airQuality?: AirQualityNow;
};

const pageVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

function readCachedAnalysis(): DashboardAnalysis | null {
  try {
    const raw = window.localStorage.getItem(DASHBOARD_ANALYSIS_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<DashboardAnalysis>;
    if (
      typeof value.savedAt !== "number" ||
      !value.position ||
      !Number.isFinite(value.position.latitude) ||
      !Number.isFinite(value.position.longitude) ||
      !value.weather ||
      !Array.isArray(value.quests)
    ) {
      return null;
    }
    return {
      ...value,
      generatedAt:
        typeof value.generatedAt === "string"
          ? value.generatedAt
          : new Date(value.savedAt).toISOString(),
    } as DashboardAnalysis;
  } catch {
    return null;
  }
}

function cacheAnalysis(analysis: DashboardAnalysis) {
  try {
    const roundedAnalysis = {
      ...analysis,
      position: {
        latitude: Math.round(analysis.position.latitude * 100) / 100,
        longitude: Math.round(analysis.position.longitude * 100) / 100,
      },
    };
    window.localStorage.setItem(DASHBOARD_ANALYSIS_KEY, JSON.stringify(roundedAnalysis));
  } catch {
    // The current analysis remains usable even when browser storage is unavailable.
  }
}

function AnimatedValue({ value }: { value: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={value}
        className="condition-value"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.2 }}
      >
        {value}
      </motion.div>
    </AnimatePresence>
  );
}

function MotionBlock({ children, className }: { children: ReactNode; className?: string }) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  return (
    <motion.div
      className={className}
      variants={
        prefersReducedMotion ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : itemVariants
      }
    >
      {children}
    </motion.div>
  );
}

function isQuestGuidanceAvailable(quest: SkyQuest, isGuidanceUnlocked: boolean): boolean {
  if (!isQuestFresh(quest)) return false;
  if (quest.targetType === "free_observation") return true;
  if (!isGuidanceUnlocked) return false;
  if (quest.targetType === "satellite") {
    return isIssQuestGuidable(quest.startsAt, quest.endsAt);
  }
  return true;
}

type QuestEase = {
  label: "Facile" | "Intermédiaire" | "Difficile";
  tone: "easy" | "moderate" | "hard";
};

function getQuestEase(quest: SkyQuest): QuestEase {
  if (quest.targetType === "free_observation") {
    return { label: "Facile", tone: "easy" };
  }

  if (quest.visibilityScore >= 75 && quest.difficulty === "easy") {
    return { label: "Facile", tone: "easy" };
  }

  if (quest.visibilityScore >= 60) {
    return { label: "Intermédiaire", tone: "moderate" };
  }

  return { label: "Difficile", tone: "hard" };
}

function QuestCard({
  quest,
  onStart,
  locked,
  stale,
  featured = false,
  evening = false,
  personalizationBadge = null,
}: {
  quest: SkyQuest;
  onStart: (quest: SkyQuest) => void;
  locked: boolean;
  stale: boolean;
  featured?: boolean;
  evening?: boolean;
  personalizationBadge?: "new_target" | "improved_retry" | null;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const isSatelliteUpcoming =
    quest.targetType === "satellite" &&
    quest.startsAt !== undefined &&
    new Date(quest.startsAt).getTime() > Date.now();
  const questEase = getQuestEase(quest);
  return (
    <motion.article
      layout
      variants={
        prefersReducedMotion ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : itemVariants
      }
      whileHover={prefersReducedMotion || locked ? undefined : { scale: 1.02, y: -2 }}
      whileTap={prefersReducedMotion || locked ? undefined : { scale: 0.99 }}
      className={getAppCardClassName({
        variant: "solid",
        padding: "lg",
        className: `quest-card ${featured ? "featured" : ""} ${locked ? "locked" : ""}`,
      })}
      onClick={() => {
        if (!locked) onStart(quest);
      }}
    >
      <div className="quest-badges">
        {featured ? (
          <div className="quest-badge recommended">{evening ? "Quête du soir" : "Recommandée"}</div>
        ) : null}
        {personalizationBadge ? (
          <div className="quest-badge personalized">
            {personalizationBadge === "new_target"
              ? "Nouvelle pour toi"
              : "Bonne soirée pour réessayer"}
          </div>
        ) : null}
        <div
          className={`quest-badge ${quest.altitude !== null && quest.altitude >= 10 ? "now" : "soon"}`}
        >
          <span className="dot" />
          {locked
            ? stale
              ? "Dernière analyse"
              : "Guidage indisponible"
            : quest.altitude !== null && quest.altitude >= 10
              ? isSatelliteUpcoming
                ? "Passage imminent"
                : "Visible maintenant"
              : "Observation prudente"}
        </div>
        <div
          className={`quest-badge difficulty ${questEase.tone}`}
          aria-label={`Difficulté estimée : ${questEase.label}`}
        >
          {questEase.label}
        </div>
      </div>
      <h3>{quest.title}</h3>
      <p>{quest.description}</p>
      <div className="quest-meta">
        <div className="quest-meta-item">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2L12 22M2 12L22 12" />
          </svg>
          {quest.altitude === null ? "Zone libre" : `Altitude ${Math.round(quest.altitude)}°`}
        </div>
        <div className="quest-meta-item">
          <svg viewBox="0 0 24 24">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {quest.cardinalDirection ?? "Horizon dégagé"}
        </div>
        <div
          role="group"
          className="quest-meta-item"
          aria-label={`${quest.visibilityLabel}. ${formatVisibilityScoreForAccessibility(quest.visibilityScore)}`}
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2" />
          </svg>
          {quest.visibilityLabel} · {formatVisibilityScore(quest.visibilityScore)}
        </div>
      </div>
      <div className="quest-action">
        <span className="quest-hint">
          {quest.tip}
          {evening ? (
            <strong className="mt-2 block text-accent-cyan">Bonus +25 Éclats d’étoile</strong>
          ) : null}
        </span>
        <AppButton
          size="sm"
          className="shrink-0 gap-1.5"
          hapticFeedback={false}
          disabled={locked}
          onClick={(event) => {
            event.stopPropagation();
            if (!locked) onStart(quest);
          }}
        >
          {locked ? "Actualise d'abord" : evening ? "Commencer la quête" : "Guider"}
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </AppButton>
      </div>
    </motion.article>
  );
}

export function Dashboard({
  notificationIntent,
  preferredTarget,
}: {
  notificationIntent?: string;
  preferredTarget?: string;
} = {}) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [quests, setQuests] = useState<SkyQuest[]>([]);
  const [bestSkyWindow, setBestSkyWindow] = useState<BestSkyWindow | null>(null);
  const [lightPollution, setLightPollution] = useState<LightPollutionEstimate | null>(null);
  const [lightingPractice, setLightingPractice] = useState<LightingPracticeEstimate | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityNow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOnboardingReady, setIsOnboardingReady] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [analysisSavedAt, setAnalysisSavedAt] = useState<number | null>(null);
  const [analysisGeneratedAt, setAnalysisGeneratedAt] = useState<string | null>(null);
  const [hasAnalysisExpired, setHasAnalysisExpired] = useState(false);
  const [isGuidanceUnlocked, setIsGuidanceUnlocked] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [discoveredTargets, setDiscoveredTargets] = useState<ReadonlySet<string>>(new Set());
  const [observations, setObservations] = useState<Observation[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [eveningAssignment, setEveningAssignment] = useState<EveningQuestAssignment | null>(null);
  const activeAnalysisRequestRef = useRef(0);
  const notificationAnalysisStartedRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousScrollBehavior = root.style.scrollBehavior;
    const previousThemeColor = themeMeta?.content;
    root.style.scrollBehavior = "smooth";
    if (themeMeta) themeMeta.content = "#0a0a0b";

    return () => {
      root.style.scrollBehavior = previousScrollBehavior;
      if (themeMeta && previousThemeColor) themeMeta.content = previousThemeColor;
    };
  }, []);

  const loadDashboard = useCallback(async (coords: GeoPosition) => {
    const requestId = ++activeAnalysisRequestRef.current;
    setLoadState("loading");
    setIsRefining(false);
    setNotice(null);

    const currentDate = new Date();
    let currentWeatherFailed = false;
    let forecastFailed = false;
    const currentWeatherPromise = fetchWeatherNow(coords.latitude, coords.longitude).catch(() => {
      currentWeatherFailed = true;
      return getFallbackWeather();
    });
    const forecastPromise = fetchWeatherForecast(coords.latitude, coords.longitude, 24).catch(
      () => {
        forecastFailed = true;
        return getFallbackWeatherForecast(currentDate);
      },
    );
    const enrichmentPromise = Promise.all([
      fetchNextIssVisiblePass({
        latitude: coords.latitude,
        longitude: coords.longitude,
        now: currentDate,
      }).catch(() => null),
      fetchTrackedSatellitePasses({
        latitude: coords.latitude,
        longitude: coords.longitude,
        now: currentDate,
      }).catch(() => []),
      fetchLightPollutionEstimate(coords.latitude, coords.longitude),
      fetchLightingPracticeEstimate(coords.latitude, coords.longitude),
      fetchAirQualityNow(coords.latitude, coords.longitude).catch(() => null),
    ]);
    const [currentWeather, forecast] = await Promise.all([currentWeatherPromise, forecastPromise]);
    if (requestId !== activeAnalysisRequestRef.current) return;

    const weatherNotice =
      currentWeatherFailed && forecastFailed
        ? "Météo indisponible : des estimations prudentes sont utilisées."
        : currentWeatherFailed
          ? "Météo actuelle indisponible : une estimation prudente est utilisée."
          : forecastFailed
            ? "Prévision horaire indisponible : le créneau est estimé prudemment."
            : null;

    const initialQuests = generateQuests({
      latitude: coords.latitude,
      longitude: coords.longitude,
      weather: currentWeather,
      now: currentDate,
      limit: 20,
    });
    const initialBestSkyWindow = calculateBestSkyWindow({
      latitude: coords.latitude,
      longitude: coords.longitude,
      forecast,
      now: currentDate,
    });

    const savedAt = Date.now();
    const generatedAt = currentDate.toISOString();
    const analysis = {
      savedAt,
      generatedAt,
      position: coords,
      weather: currentWeather,
      quests: initialQuests,
      bestSkyWindow: initialBestSkyWindow,
    };

    setWeather(currentWeather);
    setQuests(initialQuests);
    setBestSkyWindow(initialBestSkyWindow);
    setLightPollution(null);
    setLightingPractice(null);
    setAirQuality(null);
    saveBestSkyWindow(initialBestSkyWindow);
    setAnalysisSavedAt(savedAt);
    setAnalysisGeneratedAt(generatedAt);
    setHasAnalysisExpired(false);
    setIsGuidanceUnlocked(true);
    unlockedAnalysisForRuntime = savedAt;
    setNotice(weatherNotice);
    setLoadState("ready");
    cacheAnalysis(analysis);

    setIsRefining(true);
    void enrichmentPromise
      .then(
        ([
          currentIssPass,
          trackedSatellitePasses,
          currentLightPollution,
          currentLightingPractice,
          currentAirQuality,
        ]) => {
          if (requestId !== activeAnalysisRequestRef.current) return;

          const refinedQuests = generateQuests({
            latitude: coords.latitude,
            longitude: coords.longitude,
            weather: currentWeather,
            now: currentDate,
            issPass: currentIssPass,
            satellitePasses: trackedSatellitePasses,
            lightPollution: currentLightPollution,
            lightingPractice: currentLightingPractice,
            airQuality: currentAirQuality,
            limit: 20,
          });
          const refinedBestSkyWindow = calculateBestSkyWindow({
            latitude: coords.latitude,
            longitude: coords.longitude,
            forecast,
            lightPollution: currentLightPollution,
            lightingPractice: currentLightingPractice,
            now: currentDate,
          });
          const refinedAnalysis: DashboardAnalysis = {
            ...analysis,
            quests: refinedQuests,
            bestSkyWindow: refinedBestSkyWindow,
            lightPollution: currentLightPollution,
            lightingPractice: currentLightingPractice ?? undefined,
            airQuality: currentAirQuality ?? undefined,
          };

          setQuests(refinedQuests);
          setBestSkyWindow(refinedBestSkyWindow);
          setLightPollution(currentLightPollution);
          setLightingPractice(currentLightingPractice);
          setAirQuality(currentAirQuality);
          saveBestSkyWindow(refinedBestSkyWindow);
          cacheAnalysis(refinedAnalysis);
        },
      )
      .catch(() => {
        // The initial weather and astronomy results remain usable without enrichment.
      })
      .finally(() => {
        if (requestId === activeAnalysisRequestRef.current) setIsRefining(false);
      });
  }, []);

  useEffect(() => {
    setShowOnboarding(!getOnboardingCompleted());
    const progressProfile = getProgressProfile();
    setDiscoveredTargets(new Set(progressProfile.discoveredTargets.map((item) => item.target)));
    setTotalXp(progressProfile.totalXp);
    setEveningAssignment(clearExpiredEveningQuestAssignment(getLocalNightKey(new Date())));
    setIsOnboardingReady(true);

    const cachedAnalysis = readCachedAnalysis();
    if (cachedAnalysis) {
      const isFresh = isGeneratedAtFresh(cachedAnalysis.generatedAt);
      const cachedBestSkyWindow =
        cachedAnalysis.bestSkyWindow && isBestSkyWindowFresh(cachedAnalysis.bestSkyWindow)
          ? cachedAnalysis.bestSkyWindow
          : null;
      setWeather(cachedAnalysis.weather);
      setQuests(cachedAnalysis.quests);
      setBestSkyWindow(cachedBestSkyWindow);
      setLightPollution(cachedAnalysis.lightPollution ?? null);
      setLightingPractice(cachedAnalysis.lightingPractice ?? null);
      setAirQuality(cachedAnalysis.airQuality ?? null);
      setAnalysisSavedAt(cachedAnalysis.savedAt);
      setAnalysisGeneratedAt(cachedAnalysis.generatedAt);
      setHasAnalysisExpired(!isFresh);
      setIsGuidanceUnlocked(isFresh && unlockedAnalysisForRuntime === cachedAnalysis.savedAt);
      if (!isFresh) {
        setNotice("Cette analyse a expiré. Relancer Maintenant pour actualiser le ciel.");
      }
      setLoadState("ready");
    }

    if (notificationIntent && !notificationAnalysisStartedRef.current) {
      notificationAnalysisStartedRef.current = true;
      const storedLocation = getLastLocation();
      if (storedLocation) {
        void loadDashboard(storedLocation).then(() => {
          setNotice(
            preferredTarget
              ? `Analyse actualisée. ${preferredTarget} est prioritaire si les conditions le permettent.`
              : "Analyse actualisée depuis la notification.",
          );
        });
      } else {
        setNotice("Appuie sur « Maintenant » pour actualiser le ciel avec ta position.");
      }
    }
  }, [loadDashboard, notificationIntent, preferredTarget]);

  useEffect(() => {
    let isActive = true;
    void getObservations()
      .then((storedObservations) => {
        if (isActive) setObservations(storedObservations);
      })
      .catch(() => {
        // Personalization gracefully falls back to the local progress profile.
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!analysisGeneratedAt || hasAnalysisExpired) return;

    const generatedTime = new Date(analysisGeneratedAt).getTime();
    const remainingMs = generatedTime + SKY_DATA_TTL_MS - Date.now();
    const expireAnalysis = () => {
      setHasAnalysisExpired(true);
      setIsGuidanceUnlocked(false);
      unlockedAnalysisForRuntime = null;
      setNotice("Cette analyse a expiré. Relancer Maintenant pour actualiser le ciel.");
    };

    if (!Number.isFinite(generatedTime) || remainingMs <= 0) {
      expireAnalysis();
      return;
    }

    const timeoutId = window.setTimeout(expireAnalysis, remainingMs);
    return () => window.clearTimeout(timeoutId);
  }, [analysisGeneratedAt, hasAnalysisExpired]);

  async function handleRefreshRequest() {
    if (isLocationLoading) return;

    haptic("select");
    setIsGuidanceUnlocked(false);
    setHasAnalysisExpired(false);
    unlockedAnalysisForRuntime = null;
    setIsLocationLoading(true);
    setNotice(null);

    try {
      const coords = await getCurrentPosition();
      saveLastLocation(coords);
      await loadDashboard(coords);
    } catch (error) {
      activeAnalysisRequestRef.current += 1;
      setIsRefining(false);
      const fallbackWeather = getFallbackWeather();
      const fallbackQuests = generateQuests({
        latitude: null,
        longitude: null,
        weather: fallbackWeather,
        now: new Date(),
      });
      setWeather(fallbackWeather);
      setQuests(fallbackQuests);
      setBestSkyWindow(null);
      setLightPollution(null);
      setLightingPractice(null);
      setAirQuality(null);
      setAnalysisSavedAt(null);
      setAnalysisGeneratedAt(null);
      setHasAnalysisExpired(false);
      setLoadState("ready");
      setNotice(
        error instanceof Error
          ? error.message
          : "Position indisponible. Une observation libre reste possible.",
      );
    } finally {
      setIsLocationLoading(false);
    }
  }

  function handleStart(quest: SkyQuest) {
    if (!isQuestGuidanceAvailable(quest, isGuidanceUnlocked)) {
      setNotice("Appuie sur « Maintenant » pour actualiser le ciel avant de lancer un guidage.");
      return;
    }
    haptic("select");
    saveActiveQuest(quest);
    router.push(`/quest/${quest.id}`);
  }

  const averageVisibility =
    quests.length > 0
      ? Math.round(
          quests.reduce((total, quest) => total + quest.visibilityScore, 0) / quests.length,
        )
      : null;
  const guidableQuests = quests.filter((quest) => quest.targetType !== "free_observation");
  const rankedQuests = useMemo(() => {
    const ranked = rankQuestsForRecommendation(quests, {
      discoveredTargets,
      observations,
      totalXp,
    });
    if (!preferredTarget) return ranked;
    const normalizedTarget = preferredTarget.toLocaleLowerCase("fr-FR");
    return [...ranked].sort((left, right) => {
      const matches = (quest: SkyQuest) =>
        quest.target.toLocaleLowerCase("fr-FR") === normalizedTarget ||
        quest.title.toLocaleLowerCase("fr-FR").includes(normalizedTarget);
      return Number(matches(right.quest)) - Number(matches(left.quest));
    });
  }, [discoveredTargets, observations, preferredTarget, quests, totalXp]);
  const currentNightKey = getLocalNightKey(new Date());
  const eveningSelection = useMemo(
    () =>
      selectEveningQuest({
        rankedQuests: isGuidanceUnlocked ? rankedQuests : [],
        existingAssignment: eveningAssignment,
        nightKey: currentNightKey,
        totalXp,
        now: isGuidanceUnlocked && analysisGeneratedAt ? new Date(analysisGeneratedAt) : new Date(),
      }),
    [
      analysisGeneratedAt,
      currentNightKey,
      eveningAssignment,
      isGuidanceUnlocked,
      rankedQuests,
      totalXp,
    ],
  );
  const activeEveningQuest =
    eveningSelection.assignment?.status === "active" ? eveningSelection.quest : null;
  const eveningRankedQuest = activeEveningQuest
    ? {
        quest: activeEveningQuest,
        personalizationBadge:
          rankedQuests.find((item) => item.quest.id === activeEveningQuest.id)
            ?.personalizationBadge ?? null,
      }
    : null;
  const questsWithoutEveningTarget = activeEveningQuest
    ? rankedQuests.filter(
        ({ quest }) =>
          quest.target.toLocaleLowerCase("fr-FR") !==
          activeEveningQuest.target.toLocaleLowerCase("fr-FR"),
      )
    : rankedQuests;
  const recommendedQuest = eveningRankedQuest ?? rankedQuests[0] ?? null;
  const alternativeQuests = rankedQuests.slice(1, 3);
  const remainingQuests = rankedQuests.slice(3);
  const displayedAlternativeQuests = activeEveningQuest
    ? questsWithoutEveningTarget.slice(0, 2)
    : alternativeQuests;
  const displayedRemainingQuests = activeEveningQuest
    ? questsWithoutEveningTarget.slice(2)
    : remainingQuests;

  useEffect(() => {
    const next = eveningSelection.assignment;
    if (!next) return;
    const unchanged =
      eveningAssignment?.nightKey === next.nightKey &&
      eveningAssignment.target === next.target &&
      eveningAssignment.lastMatchedAt === next.lastMatchedAt &&
      eveningAssignment.status === next.status &&
      eveningAssignment.completedAt === next.completedAt;
    if (unchanged) return;

    saveEveningQuestAssignment(next);
    setEveningAssignment(next);
    if (eveningSelection.wasReassigned) {
      setNotice("Les conditions ont changé : SkyQuest a ajusté ta quête du soir.");
    }
  }, [eveningAssignment, eveningSelection]);

  const airTransparency = airQuality ? getAirTransparencyEstimate(airQuality) : null;
  const conditionsLabel =
    analysisSavedAt && !isGuidanceUnlocked
      ? "Analyse passée"
      : weather?.isDay
        ? "Ciel de jour"
        : averageVisibility !== null && averageVisibility >= 70
          ? "Ciel favorable"
          : "Ciel à vérifier";
  const analysisDateLabel = analysisSavedAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(analysisSavedAt),
      )
    : null;
  const rootVariants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : pageVariants;

  return (
    <div className="sky-dashboard">
      {isOnboardingReady && showOnboarding ? (
        <Onboarding
          onFinish={() => {
            setShowOnboarding(false);
            setOnboardingCompleted();
          }}
        />
      ) : null}

      <AppHeader eyebrow="SkyQuest" title="Maintenant" />

      <motion.main
        className="dashboard-main"
        variants={rootVariants}
        initial={false}
        animate="visible"
      >
        <MotionBlock className="conditions-bar">
          <AppCard variant="solid" padding="none" className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            <AnimatedValue value={weather ? `${Math.round(weather.cloudCover)}%` : "—"} />
            <div className="condition-label">Nuages</div>
          </AppCard>
          <AppCard
            role="group"
            variant="solid"
            padding="none"
            className="condition-item"
            aria-label={
              averageVisibility === null
                ? "Indice moyen des quêtes disponibles : indisponible"
                : `Indice moyen des quêtes disponibles : ${normalizeVisibilityScore(averageVisibility)} sur 100`
            }
          >
            <svg className="condition-icon" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <AnimatedValue
              value={
                averageVisibility === null
                  ? "—"
                  : formatVisibilityScore(averageVisibility, "compact")
              }
            />
            <div className="condition-label">Indice ciel</div>
          </AppCard>
          <AppCard variant="solid" padding="none" className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24">
              <path d="M14 14.76V3.5a2 2 0 0 0-4 0v11.26a4 4 0 1 0 4 0z" />
            </svg>
            <AnimatedValue
              value={
                typeof weather?.temperature === "number"
                  ? `${Math.round(weather.temperature)}°`
                  : "—"
              }
            />
            <div className="condition-label">Temp.</div>
          </AppCard>
          <AppCard variant="solid" padding="none" className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
            </svg>
            <AnimatedValue value={loadState === "ready" ? String(guidableQuests.length) : "—"} />
            <div className="condition-label">Cibles</div>
          </AppCard>
        </MotionBlock>

        <MotionBlock className="sky-insights-disclosure">
          <details
            className={getAppCardClassName({
              variant: "subtle",
              padding: "none",
              className: "sky-insights-details sky-quality-card",
            })}
          >
            <summary>
              <span className="sky-quality-icon-wrap" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                  <path d="M18 3v3m-1.5-1.5h3M5 5v2M4 6h2" />
                </svg>
              </span>
              <span className="sky-insights-summary-copy">
                <span className="sky-quality-kicker">Qualité du ciel</span>
                <strong>{lightPollution?.label ?? "À estimer"}</strong>
                <span className="sky-quality-advice">
                  {lightPollution?.shortAdvice ??
                    "Lance « Maintenant » pour estimer le ciel autour de toi."}
                </span>
                <small>
                  {lightPollution
                    ? `Estimation${lightPollution.confidence === "low" ? " prudente" : " locale"}, sans garantie d’observation.`
                    : "Une lecture simple de tes conditions d’observation."}
                </small>
                <span className="sky-insights-toggle-label">Comprendre ton ciel</span>
              </span>
              <svg className="sky-insights-chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </summary>

            <div className="sky-insights-content">
              <section className="visibility-explanation-inline">
                <span>Indice de visibilité</span>
                <strong>Comment SkyQuest l’estime</strong>
                <VisibilityExplanationContent />
              </section>

              {lightPollution && (airTransparency || lightingPractice) ? (
                <section
                  className="sky-quality-details"
                  aria-label="Détails sur la qualité du ciel"
                >
                  {airTransparency ? (
                    <div className="air-quality-detail">
                      <span>Transparence de l’air</span>
                      <strong>{airTransparency.label}</strong>
                      <p>{airTransparency.shortAdvice}</p>
                      <small>Estimation CAMS via Open-Meteo, pas une mesure locale.</small>
                    </div>
                  ) : null}
                  {lightingPractice ? (
                    <div className="lighting-practice-detail">
                      <span>Éclairage à {lightingPractice.municipalityName}</span>
                      <strong>{lightingPractice.label}</strong>
                      <p>{lightingPractice.shortAdvice}</p>
                      <small>Signal communal Cerema, pas une mesure du ciel en direct.</small>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </details>
        </MotionBlock>

        {analysisDateLabel ? (
          <MotionBlock
            className={getAppCardClassName({
              variant: "subtle",
              padding: "sm",
              className: `analysis-banner ${isGuidanceUnlocked ? "current" : "stale"}`,
            })}
          >
            <div>
              <strong>{isGuidanceUnlocked ? "Analyse actuelle" : "Dernière analyse"}</strong>
              <span>{analysisDateLabel}</span>
            </div>
            <p>
              {isGuidanceUnlocked
                ? "Les guidages sont disponibles pour cette analyse."
                : hasAnalysisExpired
                  ? "Cette analyse a expiré. Relancer Maintenant pour actualiser le ciel."
                  : "Ces résultats sont affichés à titre indicatif. Appuie sur « Maintenant » avant tout guidage."}
            </p>
          </MotionBlock>
        ) : null}

        <AnimatePresence mode="wait">
          {notice ? (
            <motion.div
              key={notice}
              className={getAppCardClassName({
                variant: "subtle",
                padding: "sm",
                className: "dashboard-notice",
              })}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {notice}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <MotionBlock
          className={getAppCardClassName({
            variant: "solid",
            padding: "lg",
            className: "camera-guide",
          })}
        >
          <div className="camera-guide-inner">
            <motion.div
              className="camera-icon"
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      boxShadow: [
                        "0 0 0 color-mix(in srgb, var(--accent) 0%, transparent)",
                        "0 0 28px color-mix(in srgb, var(--accent) 22%, transparent)",
                        "0 0 0 color-mix(in srgb, var(--accent) 0%, transparent)",
                      ],
                    }
              }
              transition={{ duration: 3, repeat: Infinity }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </motion.div>
            <h3>
              {isGuidanceUnlocked
                ? "Ton ciel est prêt"
                : analysisSavedAt
                  ? "Actualise avant d'observer"
                  : "Découvre ton ciel maintenant"}
            </h3>
            <p>
              {isGuidanceUnlocked
                ? `${guidableQuests.length} cible${guidableQuests.length > 1 ? "s" : ""} guidable${guidableQuests.length > 1 ? "s" : ""} selon les conditions actuelles.`
                : analysisSavedAt
                  ? "Une ancienne analyse est disponible ci-dessous, mais le ciel peut avoir changé depuis."
                  : "Autorise la position pour estimer les cibles à tenter et préparer tes quêtes."}
            </p>
            <AppButton
              size="lg"
              className="gap-2"
              hapticFeedback={false}
              isLoading={loadState === "loading" || isLocationLoading}
              onClick={() => void handleRefreshRequest()}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-none stroke-current stroke-2 [stroke-linecap:round]"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2" />
              </svg>
              {isLocationLoading
                ? "Localisation…"
                : loadState === "loading"
                  ? "Lecture du ciel…"
                  : "Maintenant"}
            </AppButton>
          </div>
        </MotionBlock>

        {eveningSelection.assignment?.status === "completed" ? (
          <MotionBlock>
            <AppCard variant="subtle" padding="sm" className="border-success/20">
              <p className="text-sm font-semibold text-success">Quête du soir accomplie</p>
              <p className="mt-1 text-xs text-muted">
                Ton bonus est enregistré. Tu peux continuer à explorer librement.
              </p>
            </AppCard>
          </MotionBlock>
        ) : loadState === "ready" && isGuidanceUnlocked && !activeEveningQuest ? (
          <MotionBlock>
            <AppCard variant="subtle" padding="sm">
              <p className="text-sm text-muted">
                Ta quête du soir apparaîtra quand une cible fiable sera disponible.
              </p>
            </AppCard>
          </MotionBlock>
        ) : null}

        {recommendedQuest ? (
          <MotionBlock className="quest-priority">
            <div className="section-header">
              <h2 className="section-title">
                {activeEveningQuest ? "Ta quête du soir" : "Ta quête recommandée"}
              </h2>
              <span
                className={`status-pill ${loadState === "loading" || isRefining ? "loading" : ""}`}
              >
                <span className="dot" />
                {loadState === "loading" ? "Calcul…" : isRefining ? "Affinage…" : conditionsLabel}
              </span>
            </div>

            <motion.div className="quest-list quest-recommended" variants={rootVariants}>
              <AnimatePresence mode="popLayout">
                <QuestCard
                  key={recommendedQuest.quest.id}
                  quest={recommendedQuest.quest}
                  onStart={handleStart}
                  locked={!isQuestGuidanceAvailable(recommendedQuest.quest, isGuidanceUnlocked)}
                  stale={analysisSavedAt !== null}
                  featured
                  evening={Boolean(activeEveningQuest)}
                  personalizationBadge={recommendedQuest.personalizationBadge}
                />
              </AnimatePresence>
            </motion.div>

            {displayedAlternativeQuests.length > 0 ? (
              <>
                <div className="alternatives-header">
                  <h3>
                    {displayedAlternativeQuests.length === 1
                      ? "Une alternative"
                      : "Deux alternatives"}
                  </h3>
                  <span>Si tu préfères une autre cible</span>
                </div>
                <motion.div className="quest-list quest-alternatives" variants={rootVariants}>
                  <AnimatePresence mode="popLayout">
                    {displayedAlternativeQuests.map(({ quest, personalizationBadge }) => (
                      <QuestCard
                        key={quest.id}
                        quest={quest}
                        onStart={handleStart}
                        locked={!isQuestGuidanceAvailable(quest, isGuidanceUnlocked)}
                        stale={analysisSavedAt !== null}
                        personalizationBadge={personalizationBadge}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </>
            ) : null}

            {displayedRemainingQuests.length > 0 ? (
              <details
                className={getAppCardClassName({
                  variant: "subtle",
                  padding: "none",
                  className: "all-quests-disclosure",
                })}
              >
                <summary>
                  <span>Voir toutes les quêtes</span>
                  <small>
                    {displayedRemainingQuests.length} autre
                    {displayedRemainingQuests.length > 1 ? "s" : ""}
                  </small>
                </summary>
                <motion.div className="quest-list all-quests-list" variants={rootVariants}>
                  {displayedRemainingQuests.map(({ quest, personalizationBadge }) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      onStart={handleStart}
                      locked={!isQuestGuidanceAvailable(quest, isGuidanceUnlocked)}
                      stale={analysisSavedAt !== null}
                      personalizationBadge={personalizationBadge}
                    />
                  ))}
                </motion.div>
              </details>
            ) : null}
          </MotionBlock>
        ) : null}
        {loadState === "idle" ? (
          <MotionBlock
            className={getAppCardClassName({
              variant: "subtle",
              padding: "lg",
              className: "empty-state py-12",
            })}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
            </svg>
            <p>Appuie sur « Maintenant » pour générer tes quêtes.</p>
          </MotionBlock>
        ) : null}

        <MotionBlock className="best-window-block">
          <BestSkyWindowCard window={bestSkyWindow} />
        </MotionBlock>
      </motion.main>
    </div>
  );
}
