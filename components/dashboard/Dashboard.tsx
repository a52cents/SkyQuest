"use client";

/**
 * Dashboard
 *
 * Orchestre le parcours « Maintenant » de la PWA installée : permission GPS, météo,
 * passage ISS optionnel, génération des quêtes, cache de l'analyse et navigation vers
 * le guidage. L'écran reste volontairement centré sur les trois meilleures quêtes du moment.
 *
 * Important :
 * - le GPS doit rester déclenché par une action utilisateur ;
 * - une panne météo ou ISS ne doit jamais bloquer les autres quêtes ;
 * - une analyse relue du cache peut être affichée, mais son guidage reste verrouillé jusqu'à
 *   une nouvelle analyse afin de ne pas utiliser silencieusement une position périmée ;
 * - l'interface classe les quêtes par pertinence et n'affiche que les trois premières.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import { fetchLightPollutionEstimate } from "@/lib/light-pollution-client";
import type { LightPollutionEstimate } from "@/lib/light-pollution";
import { fetchLightingPracticeEstimate } from "@/lib/lighting-practices-client";
import type { LightingPracticeEstimate } from "@/lib/lighting-practices";
import { getOnboardingCompleted, setOnboardingCompleted } from "@/lib/storage";
import { calculateBestSkyWindow } from "@/lib/sky-window";
import { generateQuests } from "@/lib/quest-generator";
import { isGeneratedAtFresh, isQuestFresh, SKY_DATA_TTL_MS } from "@/lib/quest-freshness";
import { saveActiveQuest, saveBestSkyWindow, saveLastLocation } from "@/lib/storage";
import type { AirQualityNow, BestSkyWindow, SkyQuest, WeatherNow } from "@/lib/types";
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
  const isSatelliteUpcoming =
    quest.targetType === "satellite" &&
    quest.startsAt !== undefined &&
    new Date(quest.startsAt).getTime() > Date.now();
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
        className: `quest-card ${locked ? "locked" : ""}`,
      })}
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
            ? isSatelliteUpcoming
              ? "Passage imminent"
              : "Visible maintenant"
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
          {locked ? "Actualise d'abord" : "Guider"}
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

export function Dashboard() {
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
    const nextBestSkyWindow = calculateBestSkyWindow({
      latitude: coords.latitude,
      longitude: coords.longitude,
      forecast,
      lightPollution: currentLightPollution,
      lightingPractice: currentLightingPractice,
      now: currentDate,
    });

    const savedAt = Date.now();
    const generatedAt = currentDate.toISOString();
    const analysis = {
      savedAt,
      generatedAt,
      position: coords,
      weather: currentWeather,
      quests: nextQuests,
      bestSkyWindow: nextBestSkyWindow,
      lightPollution: currentLightPollution,
      lightingPractice: currentLightingPractice ?? undefined,
      airQuality: currentAirQuality ?? undefined,
    };

    setWeather(currentWeather);
    setQuests(nextQuests);
    setBestSkyWindow(nextBestSkyWindow);
    setLightPollution(currentLightPollution);
    setLightingPractice(currentLightingPractice);
    setAirQuality(currentAirQuality);
    saveBestSkyWindow(nextBestSkyWindow);
    setAnalysisSavedAt(savedAt);
    setAnalysisGeneratedAt(generatedAt);
    setHasAnalysisExpired(false);
    setIsGuidanceUnlocked(true);
    unlockedAnalysisForRuntime = savedAt;
    setNotice(weatherNotice);
    setLoadState("ready");
    cacheAnalysis(analysis);
  }, []);

  useEffect(() => {
    setShowOnboarding(!getOnboardingCompleted());
    setIsOnboardingReady(true);

    const cachedAnalysis = readCachedAnalysis();
    if (cachedAnalysis) {
      const isFresh = isGeneratedAtFresh(cachedAnalysis.generatedAt);
      setWeather(cachedAnalysis.weather);
      setQuests(cachedAnalysis.quests);
      setBestSkyWindow(cachedAnalysis.bestSkyWindow ?? null);
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
  }, [loadDashboard]);

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
  const visibleQuests = quests.slice(0, 3);
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
        initial="hidden"
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
          <AppCard variant="solid" padding="none" className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <AnimatedValue
              value={averageVisibility === null ? "—" : `${Math.round(averageVisibility / 10)}/10`}
            />
            <div className="condition-label">Visibilité</div>
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
              className: "sky-insights-details",
            })}
          >
            <summary>
              <span className="sky-insights-summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                  <path d="M18 3v3m-1.5-1.5h3" />
                </svg>
              </span>
              <span className="sky-insights-summary-copy">
                <strong>Comprendre ton ciel</strong>
                <small>
                  Indice de visibilité · Qualité du ciel
                  {lightPollution ? ` · ${lightPollution.label}` : ""}
                </small>
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

              {lightPollution ? (
                <AppCard as="section" variant="subtle" padding="sm" className="sky-quality-card">
                  <svg className="sky-quality-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                    <path d="M18 3v3m-1.5-1.5h3M5 5v2M4 6h2" />
                  </svg>
                  <div>
                    <span>Qualité du ciel</span>
                    <strong>{lightPollution.label}</strong>
                    <p>{lightPollution.shortAdvice}</p>
                    <small>
                      Estimation{lightPollution.confidence === "low" ? " prudente" : " locale"},
                      sans garantie d’observation.
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
                </AppCard>
              ) : (
                <p
                  className={getAppCardClassName({
                    variant: "subtle",
                    padding: "sm",
                    className: "sky-quality-placeholder",
                  })}
                >
                  Lance « Maintenant » pour estimer la qualité du ciel autour de toi.
                </p>
              )}
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

        <MotionBlock className="section-header">
          <h2 className="section-title">
            {weather?.isDay ? "À observer maintenant" : "Quêtes du soir"}
          </h2>
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
                locked={!isQuestGuidanceAvailable(quest, isGuidanceUnlocked)}
                stale={analysisSavedAt !== null}
              />
            ))}
          </AnimatePresence>
        </motion.div>
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
