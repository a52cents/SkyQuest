"use client";

/**
 * Dashboard
 *
 * Orchestre le parcours « Maintenant » de la PWA installée : permission GPS, météo,
 * passage ISS optionnel, génération des quêtes, cache de l'analyse et navigation vers
 * le guidage. Il affiche aussi la progression, le journal récent et les événements à venir.
 *
 * Important :
 * - le GPS doit rester déclenché par une action utilisateur ;
 * - une panne météo ou ISS ne doit jamais bloquer les autres quêtes ;
 * - une analyse relue du cache peut être affichée, mais son guidage reste verrouillé jusqu'à
 *   une nouvelle analyse afin de ne pas utiliser silencieusement une position périmée ;
 * - l'interface classe les quêtes par pertinence et permet d'afficher progressivement la suite.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { fetchAirQualityNow, getAirTransparencyEstimate } from "@/lib/air-quality";
import { AppHeader } from "@/components/AppHeader";
import { BestSkyWindowCard } from "@/components/BestSkyWindowCard";
import { Onboarding } from "@/components/Onboarding";
import { PushPermissionCard } from "@/components/PushPermissionCard";
import { VisibilityExplanationCard } from "@/components/VisibilityExplanationCard";
import { getCurrentPosition, type GeoPosition } from "@/lib/browser-support";
import { getUpcomingCelestialEvents, type CelestialEventType } from "@/lib/celestial-events";
import { haptic } from "@/lib/haptics";
import { fetchNextIssVisiblePass } from "@/lib/iss";
import { fetchLightPollutionEstimate } from "@/lib/light-pollution-client";
import type { LightPollutionEstimate } from "@/lib/light-pollution";
import { fetchLightingPracticeEstimate } from "@/lib/lighting-practices-client";
import type { LightingPracticeEstimate } from "@/lib/lighting-practices";
import { getOnboardingCompleted, setOnboardingCompleted } from "@/lib/storage";
import { meteorShowers } from "@/lib/meteor-showers";
import { getNasaUpcomingEvents, type NasaHighlights, type NasaUpcomingEvent } from "@/lib/nasa";
import { calculateBestSkyWindow } from "@/lib/sky-window";
import { getAchievementProgress, getRankProgress } from "@/lib/progression";
import {
  generateFutureQuestSuggestions,
  generateQuests,
  type FutureQuestSuggestion,
} from "@/lib/quest-generator";
import {
  getObservations,
  getProgressProfile,
  saveActiveQuest,
  saveBestSkyWindow,
  saveLastLocation,
} from "@/lib/storage";
import type {
  Observation,
  AirQualityNow,
  BestSkyWindow,
  ProgressProfile,
  QuestTargetType,
  SkyQuest,
  WeatherNow,
} from "@/lib/types";
import {
  fetchWeatherForecast,
  fetchWeatherNow,
  getFallbackWeather,
  getFallbackWeatherForecast,
} from "@/lib/weather";

type LoadState = "idle" | "loading" | "ready";

type TimelineEvent = {
  id: string;
  type: CelestialEventType | "meteor_shower" | NasaUpcomingEvent["type"];
  title: string;
  date: Date;
  description: string;
  timeLabel: "instant" | "peak" | "approximate_peak";
  sourceUrl?: string;
};

const CELESTIAL_EVENT_WINDOW_DAYS = 60;
const DAY_MS = 86_400_000;
const DASHBOARD_ANALYSIS_KEY = "skyquest.dashboard-analysis.v1";
let unlockedAnalysisForRuntime: number | null = null;

type DashboardAnalysis = {
  savedAt: number;
  position: GeoPosition;
  weather: WeatherNow;
  quests: SkyQuest[];
  futureSuggestions: FutureQuestSuggestion[];
  bestSkyWindow?: BestSkyWindow;
  lightPollution?: LightPollutionEstimate;
  lightingPractice?: LightingPracticeEstimate;
  airQuality?: AirQualityNow;
};

const QUEST_TARGET_LABELS: Record<QuestTargetType, string> = {
  moon: "Lune",
  planet: "Planète",
  star: "Étoile",
  asterism: "Astérisme",
  constellation: "Constellation",
  star_cluster: "Amas d'étoiles",
  galaxy: "Galaxie",
  meteor_shower: "Pluie de météores",
  satellite: "Satellite",
  free_observation: "Observation libre",
};

const pageVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

function getMeteorShowerTimelineEvents(startDate: Date, limitDays: number): TimelineEvent[] {
  const endDate = new Date(startDate.getTime() + limitDays * DAY_MS);
  const events: TimelineEvent[] = [];

  for (let year = startDate.getUTCFullYear(); year <= endDate.getUTCFullYear(); year += 1) {
    meteorShowers.forEach((shower) => {
      const [month, day] = shower.peakDate.split("-").map(Number);
      // The source provides a calendar day but no exact peak hour. Noon UTC keeps
      // the same displayed date in Europe/Paris without claiming false precision.
      const peakDate = new Date(Date.UTC(year, month - 1, day, 12));
      if (peakDate < startDate || peakDate > endDate) return;

      events.push({
        id: `meteor-shower-${shower.id}-${year}`,
        type: "meteor_shower",
        title: `Pic des ${shower.name}`,
        date: peakDate,
        description: `Radiant : ${shower.radiantName} · ${shower.recommendedViewingTip}`,
        timeLabel: "approximate_peak",
      });
    });
  }

  return events;
}

function createEventTimeline(startDate: Date): TimelineEvent[] {
  const celestialEvents = getUpcomingCelestialEvents(
    startDate,
    CELESTIAL_EVENT_WINDOW_DAYS,
  ).map<TimelineEvent>((event) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    date: event.date,
    description: event.description,
    timeLabel:
      event.type === "lunar_eclipse" || event.type === "solar_eclipse" ? "peak" : "instant",
  }));

  return [
    ...celestialEvents,
    ...getMeteorShowerTimelineEvents(startDate, CELESTIAL_EVENT_WINDOW_DAYS),
  ].sort((left, right) => left.date.getTime() - right.date.getTime());
}

function mergeNasaTimelineEvents(
  timeline: TimelineEvent[],
  highlights: NasaHighlights,
  startDate: Date,
): TimelineEvent[] {
  const nasaEvents = getNasaUpcomingEvents(
    highlights,
    startDate,
    CELESTIAL_EVENT_WINDOW_DAYS,
  ).map<TimelineEvent>((event) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    date: new Date(event.occursAt),
    description: event.description,
    timeLabel: "instant",
    sourceUrl: event.sourceUrl,
  }));

  return [...timeline, ...nasaEvents].sort(
    (left, right) => left.date.getTime() - right.date.getTime(),
  );
}

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
      !Array.isArray(value.quests) ||
      !Array.isArray(value.futureSuggestions)
    ) {
      return null;
    }
    return value as DashboardAnalysis;
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

function QuestCard({
  quest,
  onStart,
  locked,
  stale,
}: {
  quest: SkyQuest;
  onStart: (quest: SkyQuest) => void;
  locked: boolean;
  stale: boolean;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  return (
    <motion.article
      layout
      variants={
        prefersReducedMotion ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : itemVariants
      }
      whileHover={prefersReducedMotion || locked ? undefined : { scale: 1.02, y: -2 }}
      whileTap={prefersReducedMotion || locked ? undefined : { scale: 0.99 }}
      className={`quest-card ${locked ? "locked" : ""}`}
      onClick={() => {
        if (!locked) onStart(quest);
      }}
    >
      <div
        className={`quest-badge ${quest.altitude !== null && quest.altitude >= 10 ? "now" : "soon"}`}
      >
        <span className="dot" />
        {locked
          ? stale
            ? "Dernière analyse"
            : "Guidage indisponible"
          : quest.altitude !== null && quest.altitude >= 10
            ? "Visible maintenant"
            : "Observation prudente"}
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
        <div className="quest-meta-item">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2" />
          </svg>
          Visibilité {quest.visibilityScore}/100
        </div>
      </div>
      <div className="quest-action">
        <span className="quest-hint">{quest.tip}</span>
        <button
          type="button"
          className="quest-btn"
          disabled={locked}
          onClick={(event) => {
            event.stopPropagation();
            if (!locked) onStart(quest);
          }}
        >
          {locked ? "Actualise d'abord" : "Guider"}
          <svg viewBox="0 0 24 24">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </motion.article>
  );
}

export function Dashboard() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [quests, setQuests] = useState<SkyQuest[]>([]);
  const [futureSuggestions, setFutureSuggestions] = useState<FutureQuestSuggestion[]>([]);
  const [bestSkyWindow, setBestSkyWindow] = useState<BestSkyWindow | null>(null);
  const [lightPollution, setLightPollution] = useState<LightPollutionEstimate | null>(null);
  const [lightingPractice, setLightingPractice] = useState<LightingPracticeEstimate | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityNow | null>(null);
  const [eventTimeline, setEventTimeline] = useState<TimelineEvent[]>([]);
  const [profile, setProfile] = useState<ProgressProfile | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOnboardingReady, setIsOnboardingReady] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [analysisSavedAt, setAnalysisSavedAt] = useState<number | null>(null);
  const [isGuidanceUnlocked, setIsGuidanceUnlocked] = useState(false);
  const [showAllQuests, setShowAllQuests] = useState(false);

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
    setLoadState("loading");
    setNotice(null);

    const currentDate = new Date();
    let currentWeatherFailed = false;
    let forecastFailed = false;
    const [
      currentWeather,
      forecast,
      currentIssPass,
      futureIssPass,
      currentLightPollution,
      currentLightingPractice,
      currentAirQuality,
    ] = await Promise.all([
      fetchWeatherNow(coords.latitude, coords.longitude).catch(() => {
        currentWeatherFailed = true;
        return getFallbackWeather();
      }),
      fetchWeatherForecast(coords.latitude, coords.longitude, 24).catch(() => {
        forecastFailed = true;
        return getFallbackWeatherForecast(currentDate);
      }),
      fetchNextIssVisiblePass({
        latitude: coords.latitude,
        longitude: coords.longitude,
        now: currentDate,
      }).catch(() => null),
      fetchNextIssVisiblePass({
        latitude: coords.latitude,
        longitude: coords.longitude,
        now: currentDate,
        horizonMinutes: 24 * 60,
      }).catch(() => null),
      fetchLightPollutionEstimate(coords.latitude, coords.longitude),
      fetchLightingPracticeEstimate(coords.latitude, coords.longitude),
      fetchAirQualityNow(coords.latitude, coords.longitude).catch(() => null),
    ]);
    const weatherNotice =
      currentWeatherFailed && forecastFailed
        ? "Météo indisponible : des estimations prudentes sont utilisées."
        : currentWeatherFailed
          ? "Météo actuelle indisponible : une estimation prudente est utilisée."
          : forecastFailed
            ? "Prévision horaire indisponible : le créneau est estimé prudemment."
            : null;

    const nextQuests = generateQuests({
      latitude: coords.latitude,
      longitude: coords.longitude,
      weather: currentWeather,
      now: currentDate,
      issPass: currentIssPass,
      lightPollution: currentLightPollution,
      lightingPractice: currentLightingPractice,
      airQuality: currentAirQuality,
      limit: 20,
    });
    const nextFutureSuggestions = generateFutureQuestSuggestions({
      latitude: coords.latitude,
      longitude: coords.longitude,
      weather: currentWeather,
      now: currentDate,
      issPass: futureIssPass,
      lightPollution: currentLightPollution,
      lightingPractice: currentLightingPractice,
      excludedTargets: new Set(nextQuests.map((quest) => quest.target)),
      horizonMinutes: 7 * 24 * 60,
    });
    const nextBestSkyWindow = calculateBestSkyWindow({
      latitude: coords.latitude,
      longitude: coords.longitude,
      forecast,
      lightPollution: currentLightPollution,
      lightingPractice: currentLightingPractice,
      now: currentDate,
    });

    const savedAt = Date.now();
    const analysis = {
      savedAt,
      position: coords,
      weather: currentWeather,
      quests: nextQuests,
      futureSuggestions: nextFutureSuggestions,
      bestSkyWindow: nextBestSkyWindow,
      lightPollution: currentLightPollution,
      lightingPractice: currentLightingPractice ?? undefined,
      airQuality: currentAirQuality ?? undefined,
    };

    setWeather(currentWeather);
    setQuests(nextQuests);
    setFutureSuggestions(nextFutureSuggestions);
    setBestSkyWindow(nextBestSkyWindow);
    setLightPollution(currentLightPollution);
    setLightingPractice(currentLightingPractice);
    setAirQuality(currentAirQuality);
    saveBestSkyWindow(nextBestSkyWindow);
    setAnalysisSavedAt(savedAt);
    setIsGuidanceUnlocked(true);
    unlockedAnalysisForRuntime = savedAt;
    setShowAllQuests(false);
    setNotice(weatherNotice);
    setLoadState("ready");
    cacheAnalysis(analysis);
  }, []);

  useEffect(() => {
    let isActive = true;
    const currentDate = new Date();
    const localTimeline = createEventTimeline(currentDate);
    setEventTimeline(localTimeline);
    void fetch("/api/nasa/highlights")
      .then((response) => {
        if (!response.ok) throw new Error("NASA events unavailable");
        return response.json() as Promise<NasaHighlights>;
      })
      .then((highlights) => {
        if (isActive) {
          setEventTimeline(mergeNasaTimelineEvents(localTimeline, highlights, currentDate));
        }
      })
      .catch(() => {
        // The locally calculated timeline remains complete when NASA is unavailable.
      });
    setProfile(getProgressProfile());
    void getObservations().then((storedObservations) => {
      if (isActive) setObservations(storedObservations);
    });
    setShowOnboarding(!getOnboardingCompleted());
    setIsOnboardingReady(true);

    const cachedAnalysis = readCachedAnalysis();
    if (cachedAnalysis) {
      setWeather(cachedAnalysis.weather);
      setQuests(cachedAnalysis.quests);
      setFutureSuggestions(cachedAnalysis.futureSuggestions);
      setBestSkyWindow(cachedAnalysis.bestSkyWindow ?? null);
      setLightPollution(cachedAnalysis.lightPollution ?? null);
      setLightingPractice(cachedAnalysis.lightingPractice ?? null);
      setAirQuality(cachedAnalysis.airQuality ?? null);
      setAnalysisSavedAt(cachedAnalysis.savedAt);
      setIsGuidanceUnlocked(unlockedAnalysisForRuntime === cachedAnalysis.savedAt);
      setLoadState("ready");
    }

    return () => {
      isActive = false;
    };
  }, [loadDashboard]);

  async function handleRefreshRequest() {
    if (isLocationLoading) return;

    haptic("select");
    setIsGuidanceUnlocked(false);
    setIsLocationLoading(true);
    setNotice(null);

    try {
      const coords = await getCurrentPosition();
      saveLastLocation(coords);
      await loadDashboard(coords);
    } catch (error) {
      const fallbackQuests = generateQuests({
        latitude: null,
        longitude: null,
        weather: getFallbackWeather(),
        now: new Date(),
      });
      setQuests((currentQuests) => (currentQuests.length > 0 ? currentQuests : fallbackQuests));
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
    if (!isGuidanceUnlocked) {
      setNotice("Appuie sur « Maintenant » pour actualiser le ciel avant de lancer un guidage.");
      return;
    }
    haptic("select");
    saveActiveQuest(quest);
    router.push(`/quest/${quest.id}`);
  }

  const rank = profile ? getRankProgress(profile.totalXp) : null;
  const achievementProgress = profile ? getAchievementProgress(profile) : [];
  const unlockedAchievementCount = achievementProgress.filter(
    (achievement) => achievement.unlocked,
  ).length;
  const averageVisibility =
    quests.length > 0
      ? Math.round(
          quests.reduce((total, quest) => total + quest.visibilityScore, 0) / quests.length,
        )
      : null;
  const guidableQuests = quests.filter((quest) => quest.targetType !== "free_observation");
  const visibleQuests = showAllQuests ? quests : quests.slice(0, 3);
  const currentTargets = new Set(quests.map((quest) => quest.target));
  const distinctFutureSuggestions = futureSuggestions.filter(
    (suggestion) => !currentTargets.has(suggestion.quest.target),
  );
  const recentObservations = observations.slice(0, 2);
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

      <AppHeader
        eyebrow="SkyQuest"
        title="Maintenant"
        action={
          <Link
            href="/glossary"
            aria-label="Ouvrir le glossaire"
            title="Glossaire"
            className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/10 bg-white/[0.045] text-base font-bold text-muted transition-colors hover:border-accent/40 hover:text-text"
          >
            ?
          </Link>
        }
      />

      <motion.main
        className="dashboard-main"
        variants={rootVariants}
        initial="hidden"
        animate="visible"
      >
        <MotionBlock className="conditions-bar">
          <div className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            <AnimatedValue value={weather ? `${Math.round(weather.cloudCover)}%` : "—"} />
            <div className="condition-label">Nuages</div>
          </div>
          <div className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <AnimatedValue
              value={averageVisibility === null ? "—" : `${Math.round(averageVisibility / 10)}/10`}
            />
            <div className="condition-label">Visibilité</div>
          </div>
          <div className="condition-item">
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
          </div>
          <div className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
            </svg>
            <AnimatedValue value={loadState === "ready" ? String(guidableQuests.length) : "—"} />
            <div className="condition-label">Cibles</div>
          </div>
        </MotionBlock>

        <MotionBlock>
          <VisibilityExplanationCard compact />
        </MotionBlock>

        {lightPollution ? (
          <MotionBlock className="sky-quality-card">
            <svg className="sky-quality-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
              <path d="M18 3v3m-1.5-1.5h3M5 5v2M4 6h2" />
            </svg>
            <div>
              <span>Qualité du ciel</span>
              <strong>{lightPollution.label}</strong>
              <p>{lightPollution.shortAdvice}</p>
              <small>
                Estimation{lightPollution.confidence === "low" ? " prudente" : " locale"}, sans
                garantie d’observation.
              </small>
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
            </div>
          </MotionBlock>
        ) : null}

        {analysisDateLabel ? (
          <MotionBlock className={`analysis-banner ${isGuidanceUnlocked ? "current" : "stale"}`}>
            <div>
              <strong>{isGuidanceUnlocked ? "Analyse actuelle" : "Dernière analyse"}</strong>
              <span>{analysisDateLabel}</span>
            </div>
            <p>
              {isGuidanceUnlocked
                ? "Les guidages sont disponibles pour cette analyse."
                : "Ces résultats sont affichés à titre indicatif. Appuie sur « Maintenant » avant tout guidage."}
            </p>
          </MotionBlock>
        ) : null}

        <AnimatePresence mode="wait">
          {notice ? (
            <motion.div
              key={notice}
              className="dashboard-notice"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {notice}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <MotionBlock className="camera-guide">
          <div className="camera-guide-inner">
            <motion.div
              className="camera-icon"
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      boxShadow: [
                        "0 0 0 rgba(124,92,255,0)",
                        "0 0 28px rgba(124,92,255,.22)",
                        "0 0 0 rgba(124,92,255,0)",
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
                  : "Autorise la position pour calculer les objets réellement visibles et préparer tes quêtes."}
            </p>
            <motion.button
              type="button"
              className="camera-btn"
              onClick={() => void handleRefreshRequest()}
              disabled={loadState === "loading" || isLocationLoading}
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            >
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2" />
              </svg>
              {isLocationLoading
                ? "Localisation…"
                : loadState === "loading"
                  ? "Lecture du ciel…"
                  : "Maintenant"}
            </motion.button>
          </div>
        </MotionBlock>

        <MotionBlock>
          <BestSkyWindowCard window={bestSkyWindow} />
        </MotionBlock>

        <MotionBlock className="section-header">
          <h2 className="section-title">Quêtes du soir</h2>
          <span className={`status-pill ${loadState === "loading" ? "loading" : ""}`}>
            <span className="dot" />
            {loadState === "loading" ? "Calcul…" : conditionsLabel}
          </span>
        </MotionBlock>

        <motion.div className="quest-list" variants={rootVariants}>
          <AnimatePresence mode="popLayout">
            {visibleQuests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onStart={handleStart}
                locked={!isGuidanceUnlocked}
                stale={analysisSavedAt !== null}
              />
            ))}
          </AnimatePresence>
        </motion.div>
        {quests.length > 3 ? (
          <button
            type="button"
            className="show-more-btn"
            onClick={() => setShowAllQuests((current) => !current)}
          >
            {showAllQuests ? "Réduire la liste" : `Voir les ${quests.length - 3} autres quêtes`}
          </button>
        ) : null}
        {loadState === "idle" ? (
          <MotionBlock className="empty-state">
            <svg viewBox="0 0 24 24">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
            </svg>
            <p>Appuie sur « Maintenant » pour générer tes quêtes.</p>
          </MotionBlock>
        ) : null}

        <section id="objects">
          <MotionBlock className="section-header spaced">
            <h2 className="section-title">Objets observables</h2>
            <span className="section-sub">
              {guidableQuests.length} cible{guidableQuests.length > 1 ? "s" : ""}
            </span>
          </MotionBlock>
          <motion.div className="upcoming-list" variants={rootVariants}>
            {guidableQuests.map((quest) => (
              <motion.button
                key={quest.id}
                type="button"
                disabled={!isGuidanceUnlocked}
                onClick={() => handleStart(quest)}
                className={`upcoming-item ${!isGuidanceUnlocked ? "locked" : ""}`}
                variants={itemVariants}
                whileHover={
                  prefersReducedMotion || !isGuidanceUnlocked ? undefined : { scale: 1.02 }
                }
              >
                <div className="upcoming-date">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      className="day"
                      key={Math.round(quest.altitude ?? 0)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {quest.altitude === null ? "—" : `${Math.round(quest.altitude)}°`}
                    </motion.div>
                  </AnimatePresence>
                  <div className="month">Alt.</div>
                </div>
                <div className="upcoming-info">
                  <h4>{quest.title}</h4>
                  <p>
                    {QUEST_TARGET_LABELS[quest.targetType]} ·{" "}
                    {quest.cardinalDirection ?? "Zone large"} · {quest.visibilityScore}/100
                  </p>
                </div>
                <svg className="upcoming-arrow" viewBox="0 0 24 24">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </motion.button>
            ))}
          </motion.div>
          {loadState === "ready" && guidableQuests.length === 0 ? (
            <div className="empty-state">
              <p>
                Aucun objet suffisamment fiable maintenant. Une observation libre reste possible.
              </p>
            </div>
          ) : null}
        </section>

        <section id="observation-windows">
          <MotionBlock className="section-header spaced">
            <h2 className="section-title">À venir</h2>
            <span className="section-sub">Informatif · non guidable</span>
          </MotionBlock>
          <motion.div className="upcoming-list" variants={rootVariants}>
            {distinctFutureSuggestions.slice(0, 3).map((suggestion) => {
              const date = new Date(suggestion.availableAt);
              return (
                <motion.article
                  key={`${suggestion.quest.id}-${suggestion.availableAt}`}
                  className="upcoming-item future-item"
                  variants={itemVariants}
                >
                  <div className="upcoming-date">
                    <div className="day">{date.getDate()}</div>
                    <div className="month">
                      {new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date)}
                    </div>
                  </div>
                  <div className="upcoming-info">
                    <h4>{suggestion.quest.title}</h4>
                    <p>
                      {new Intl.DateTimeFormat("fr-FR", {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(date)}{" "}
                      · conditions à revérifier
                    </p>
                  </div>
                  <svg className="upcoming-arrow" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </motion.article>
              );
            })}
          </motion.div>
          {loadState === "ready" && distinctFutureSuggestions.length === 0 ? (
            <div className="empty-state">
              <p>Aucune cible différente trouvée dans les sept prochains jours.</p>
            </div>
          ) : null}
        </section>

        <section id="upcoming">
          <MotionBlock className="section-header spaced">
            <h2 className="section-title">Prochains événements</h2>
            <span className="section-sub">Astronomie + NASA · 60 jours</span>
          </MotionBlock>
          <motion.div
            className="upcoming-list"
            variants={rootVariants}
            initial="hidden"
            animate="visible"
          >
            {eventTimeline.map((event) => {
              const localDate = new Intl.DateTimeFormat("fr-FR", {
                day: "numeric",
                month: "short",
                timeZone: "Europe/Paris",
              }).format(event.date);
              const [day, ...monthParts] = localDate.replace(".", "").split(" ");
              const localTime = new Intl.DateTimeFormat("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Paris",
              }).format(event.date);
              const timing =
                event.timeLabel === "approximate_peak"
                  ? "Pic approximatif"
                  : event.timeLabel === "peak"
                    ? `Pic à ${localTime}`
                    : `À ${localTime}`;

              return (
                <motion.article
                  key={event.id}
                  className="upcoming-item"
                  variants={itemVariants}
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                >
                  <div className="upcoming-date">
                    <div className="day">{day}</div>
                    <div className="month">{monthParts.join(" ")}</div>
                  </div>
                  <div className="upcoming-info">
                    <h4>{event.title}</h4>
                    <p>
                      {timing} · {event.description}
                    </p>
                    {event.sourceUrl ? (
                      <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="nasa-event-link"
                      >
                        Fiche NASA JPL ↗
                      </a>
                    ) : null}
                  </div>
                  <svg className="upcoming-arrow event-star" viewBox="0 0 24 24">
                    <path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2z" />
                  </svg>
                </motion.article>
              );
            })}
          </motion.div>
        </section>

        <MotionBlock>
          <PushPermissionCard className="my-6" />
        </MotionBlock>

        <section id="journal">
          <MotionBlock className="section-header spaced">
            <h2 className="section-title">Journal</h2>
            <span className="section-sub">Tes observations</span>
          </MotionBlock>
          <MotionBlock className="journal-preview">
            {recentObservations.map((observation) => (
              <Link href="/journal" className="journal-card" key={observation.id}>
                <div className="date">
                  {new Intl.DateTimeFormat("fr-FR", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(observation.createdAt))}
                </div>
                <h4>{observation.questTitle}</h4>
                <p>
                  {observation.status === "seen"
                    ? `Observation confirmée · +${observation.xpEarned ?? 0} XP`
                    : "Cible non aperçue · résultat enregistré"}
                </p>
              </Link>
            ))}
            <Link href="/journal" className="journal-card empty">
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>{recentObservations.length ? "Voir le journal" : "Première observation"}</span>
            </Link>
          </MotionBlock>
        </section>

        <section id="progression">
          <MotionBlock className="section-header spaced">
            <h2 className="section-title">Progression</h2>
            <span className="section-sub">
              {unlockedAchievementCount}/{achievementProgress.length || 7} succès
            </span>
          </MotionBlock>
          <MotionBlock className="progress-card">
            <div className="progress-top">
              <div className="progress-rank">{rank?.current.name ?? "Curieux du ciel"}</div>
              <div className="progress-xp">{profile?.totalXp ?? 0} XP</div>
            </div>
            <div className="progress-track">
              <motion.div
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${rank?.progressPercent ?? 0}%` }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="progress-meta">
              <span>
                {profile?.currentStreak ?? 0} nuit{profile?.currentStreak === 1 ? "" : "s"} de suite
              </span>
              <span>
                {rank?.next ? `${rank.xpToNext} XP avant ${rank.next.name}` : "Rang maximum"}
              </span>
            </div>
          </MotionBlock>
        </section>
      </motion.main>
    </div>
  );
}
