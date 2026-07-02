"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { Onboarding } from "@/components/Onboarding";
import { equatorialToHorizontal, getSkyObjects, getSunAltitude } from "@/lib/astro";
import { getCurrentPosition, type GeoPosition } from "@/lib/browser-support";
import { getUpcomingCelestialEvents, type CelestialEventType } from "@/lib/celestial-events";
import { haptic } from "@/lib/haptics";
import { fetchNextIssVisiblePass } from "@/lib/iss";
import { isOnboardingCompleted, setOnboardingCompleted } from "@/lib/onboarding";
import { meteorShowers } from "@/lib/meteor-showers";
import { azimuthToCardinal } from "@/lib/orientation";
import { isPopunderAdOnCooldown, triggerPopunderAd } from "@/lib/popunder-ad";
import { getAchievementProgress, getRankProgress } from "@/lib/progression";
import { generateFutureQuestSuggestions, generateQuests, type FutureQuestSuggestion } from "@/lib/quest-generator";
import { catalogSkyObjects, type CatalogObjectType } from "@/lib/sky-catalog";
import { getLastLocation, getObservations, getProgressProfile, saveActiveQuest, saveLastLocation } from "@/lib/storage";
import type { Observation, ProgressProfile, SkyObjectName, SkyQuest, WeatherNow } from "@/lib/types";
import { calculateCatalogVisibilityScore, calculateVisibilityScore } from "@/lib/visibility";
import { fetchWeatherNow, getFallbackWeather } from "@/lib/weather";

type LoadState = "idle" | "loading" | "ready";

type ObservableEntry = {
  id: string;
  name: string;
  type: string;
  altitude: number;
  azimuth: number;
  score: number;
};

type TimelineEvent = {
  id: string;
  type: CelestialEventType | "meteor_shower";
  title: string;
  date: Date;
  description: string;
  timeLabel: "instant" | "peak" | "approximate_peak";
};

const CELESTIAL_EVENT_WINDOW_DAYS = 60;
const DAY_MS = 86_400_000;

const PLANET_LABELS: Record<SkyObjectName, string> = {
  Moon: "Lune",
  Venus: "Vénus",
  Jupiter: "Jupiter",
  Saturn: "Saturne",
  Mars: "Mars",
};

const CATALOG_TYPE_LABELS: Record<CatalogObjectType, string> = {
  star: "Étoile",
  asterism: "Astérisme",
  constellation: "Constellation",
  star_cluster: "Amas d'étoiles",
  galaxy: "Galaxie",
  meteor_shower: "Pluie de météores",
  satellite: "Satellite",
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
  const celestialEvents = getUpcomingCelestialEvents(startDate, CELESTIAL_EVENT_WINDOW_DAYS).map<TimelineEvent>((event) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    date: event.date,
    description: event.description,
    timeLabel: event.type === "lunar_eclipse" || event.type === "solar_eclipse" ? "peak" : "instant",
  }));

  return [...celestialEvents, ...getMeteorShowerTimelineEvents(startDate, CELESTIAL_EVENT_WINDOW_DAYS)]
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

function computeObservableEntries(position: GeoPosition, weather: WeatherNow, now: Date): ObservableEntry[] {
  const sunAltitude = getSunAltitude(position.latitude, position.longitude, now);
  const planets = getSkyObjects(position.latitude, position.longitude, now)
    .map((object) => ({
      id: object.name.toLowerCase(),
      name: PLANET_LABELS[object.name],
      type: object.name === "Moon" ? "Lune" : "Planète",
      altitude: object.altitude,
      azimuth: object.azimuth,
      score: calculateVisibilityScore({ object, weather, sunAltitude }),
    }))
    .filter((object) => object.altitude >= 0 && object.score >= 50);

  const catalog = catalogSkyObjects.flatMap<ObservableEntry>((object) => {
    if (
      object.type === "satellite" ||
      typeof object.rightAscensionHours !== "number" ||
      typeof object.declinationDegrees !== "number"
    ) {
      return [];
    }

    const horizontal = equatorialToHorizontal({
      rightAscensionHours: object.rightAscensionHours,
      declinationDegrees: object.declinationDegrees,
      latitude: position.latitude,
      longitude: position.longitude,
      date: now,
    });
    const score = calculateCatalogVisibilityScore({
      object,
      altitude: horizontal.altitude,
      weather,
      sunAltitude,
      now,
    });

    return score >= 50
      ? [{
          id: object.id,
          name: object.frenchName,
          type: CATALOG_TYPE_LABELS[object.type],
          altitude: horizontal.altitude,
          azimuth: horizontal.azimuth,
          score,
        }]
      : [];
  });

  return [...planets, ...catalog].sort((left, right) => right.score - left.score);
}

function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle className="star" cx="12" cy="5" r="1.2" />
        <circle className="star" cx="7" cy="16" r="0.8" />
        <circle className="star" cx="19" cy="14" r="1" />
        <path d="M12 5 L7 16 L19 14 Z" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      </svg>
    </span>
  );
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
      variants={prefersReducedMotion ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : itemVariants}
    >
      {children}
    </motion.div>
  );
}

function QuestCard({ quest, onStart }: { quest: SkyQuest; onStart: (quest: SkyQuest) => void }) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  return (
    <motion.article
      layout
      variants={prefersReducedMotion ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : itemVariants}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -2 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
      className="quest-card"
      onClick={() => onStart(quest)}
    >
      <div className={`quest-badge ${quest.altitude !== null && quest.altitude >= 10 ? "now" : "soon"}`}>
        <span className="dot" />
        {quest.altitude !== null && quest.altitude >= 10 ? "Visible maintenant" : "Observation prudente"}
      </div>
      <h3>{quest.title}</h3>
      <p>{quest.description}</p>
      <div className="quest-meta">
        <div className="quest-meta-item">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 2L12 22M2 12L22 12" /></svg>
          {quest.altitude === null ? "Zone libre" : `Altitude ${Math.round(quest.altitude)}°`}
        </div>
        <div className="quest-meta-item">
          <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          {quest.cardinalDirection ?? "Horizon dégagé"}
        </div>
        <div className="quest-meta-item">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2" /></svg>
          Visibilité {quest.visibilityScore}/100
        </div>
      </div>
      <div className="quest-action">
        <span className="quest-hint">{quest.tip}</span>
        <button type="button" className="quest-btn" onClick={(event) => { event.stopPropagation(); onStart(quest); }}>
          Guider
          <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
    </motion.article>
  );
}

export function Dashboard() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [quests, setQuests] = useState<SkyQuest[]>([]);
  const [futureSuggestions, setFutureSuggestions] = useState<FutureQuestSuggestion[]>([]);
  const [eventTimeline, setEventTimeline] = useState<TimelineEvent[]>([]);
  const [observableEntries, setObservableEntries] = useState<ObservableEntry[]>([]);
  const [profile, setProfile] = useState<ProgressProfile | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOnboardingReady, setIsOnboardingReady] = useState(false);
  const [showAdConsent, setShowAdConsent] = useState(false);
  const [isAdLoading, setIsAdLoading] = useState(false);

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
    setPosition(coords);

    let weatherNotice: string | null = null;
    const currentWeather = await fetchWeatherNow(coords.latitude, coords.longitude).catch(() => {
      weatherNotice = "Météo indisponible : une estimation prudente est utilisée.";
      return getFallbackWeather();
    });
    const currentDate = new Date();
    const [currentIssPass, futureIssPass] = await Promise.all([
      fetchNextIssVisiblePass({ latitude: coords.latitude, longitude: coords.longitude, now: currentDate }).catch(() => null),
      fetchNextIssVisiblePass({ latitude: coords.latitude, longitude: coords.longitude, now: currentDate, horizonMinutes: 24 * 60 }).catch(() => null),
    ]);

    const nextQuests = generateQuests({
      latitude: coords.latitude,
      longitude: coords.longitude,
      weather: currentWeather,
      now: currentDate,
      issPass: currentIssPass,
    });
    const nextFutureSuggestions = generateFutureQuestSuggestions({
      latitude: coords.latitude,
      longitude: coords.longitude,
      weather: currentWeather,
      now: currentDate,
      issPass: futureIssPass,
    });

    setWeather(currentWeather);
    setQuests(nextQuests);
    setFutureSuggestions(nextFutureSuggestions);
    setObservableEntries(computeObservableEntries(coords, currentWeather, currentDate));
    setNotice(weatherNotice);
    setLoadState("ready");
  }, []);

  useEffect(() => {
    const currentDate = new Date();
    setNow(currentDate);
    setEventTimeline(createEventTimeline(currentDate));
    setProfile(getProgressProfile());
    setObservations(getObservations());
    setShowOnboarding(!isOnboardingCompleted());
    setIsOnboardingReady(true);

    const storedPosition = getLastLocation();
    if (storedPosition) {
      void loadDashboard(storedPosition);
    }

    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  useEffect(() => {
    if (!position || !weather) return;
    const timer = window.setInterval(() => {
      setObservableEntries(computeObservableEntries(position, weather, new Date()));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [position, weather]);

  async function requestCurrentSky() {
    haptic("select");
    try {
      const coords = await getCurrentPosition();
      saveLastLocation(coords);
      await loadDashboard(coords);
    } catch (error) {
      const fallbackQuests = generateQuests({ latitude: null, longitude: null, weather: getFallbackWeather(), now: new Date() });
      setQuests(fallbackQuests);
      setLoadState("ready");
      setNotice(error instanceof Error ? error.message : "Position indisponible. Une observation libre reste possible.");
    }
  }

  function handleRefreshRequest() {
    if (isPopunderAdOnCooldown()) {
      void requestCurrentSky();
      return;
    }
    setShowAdConsent(true);
  }

  async function handleAdConfirm() {
    if (isAdLoading) return;
    setIsAdLoading(true);
    await triggerPopunderAd();
    setIsAdLoading(false);
    setShowAdConsent(false);
    await requestCurrentSky();
  }

  function handleStart(quest: SkyQuest) {
    haptic("select");
    saveActiveQuest(quest);
    router.push(`/quest/${quest.id}`);
  }

  function handleCameraAction() {
    const firstGuidedQuest = quests.find((quest) => quest.targetType !== "free_observation");
    if (firstGuidedQuest) {
      handleStart(firstGuidedQuest);
      return;
    }
    handleRefreshRequest();
  }

  const rank = profile ? getRankProgress(profile.totalXp) : null;
  const achievementProgress = profile ? getAchievementProgress(profile) : [];
  const unlockedAchievementCount = achievementProgress.filter((achievement) => achievement.unlocked).length;
  const averageVisibility = quests.length > 0
    ? Math.round(quests.reduce((total, quest) => total + quest.visibilityScore, 0) / quests.length)
    : null;
  const visibleQuests = quests.slice(0, 3);
  const visibleObjects = observableEntries.slice(0, 4);
  const recentObservations = observations.slice(0, 2);
  const locationLabel = position
    ? `${position.latitude.toFixed(2)}°, ${position.longitude.toFixed(2)}°`
    : "Position non chargée";
  const conditionsLabel = weather?.isDay
    ? "Ciel de jour"
    : averageVisibility !== null && averageVisibility >= 70
      ? "Ciel favorable"
      : "Ciel à vérifier";
  const rootVariants = prefersReducedMotion ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : pageVariants;

  return (
    <div className="sky-dashboard">
      {isOnboardingReady && showOnboarding ? (
        <Onboarding onFinish={() => { setShowOnboarding(false); setOnboardingCompleted(); }} />
      ) : null}

      <AnimatePresence>
        {showAdConsent ? (
          <motion.div className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-ad-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="dashboard-modal-card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}>
              <h2 id="dashboard-ad-title">Avant de lire le ciel</h2>
              <p>Une publicité s&apos;ouvre seulement après ton accord. SkyQuest chargera ensuite les conditions et les quêtes autour de toi.</p>
              <div className="modal-actions">
                <button type="button" className="camera-btn" onClick={() => void handleAdConfirm()} disabled={isAdLoading}>{isAdLoading ? "Ouverture…" : "Continuer"}</button>
                <button type="button" className="modal-secondary" onClick={() => setShowAdConsent(false)} disabled={isAdLoading}>Pas maintenant</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.header id="dashboard-top" className="app-header" initial={prefersReducedMotion ? false : { opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}>
        <div className="header-inner">
          <div className="header-logo"><LogoMark />SkyQuest</div>
          <div className="header-meta">
            <div className="header-time">{now ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(now) : "--:--"}</div>
            <div className="header-location">
              <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              {locationLabel}
            </div>
          </div>
        </div>
      </motion.header>

      <motion.main className="dashboard-main" variants={rootVariants} initial="hidden" animate="visible">
        <MotionBlock className="conditions-bar">
          <div className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>
            <AnimatedValue value={weather ? `${Math.round(weather.cloudCover)}%` : "—"} />
            <div className="condition-label">Nuages</div>
          </div>
          <div className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            <AnimatedValue value={averageVisibility === null ? "—" : `${Math.round(averageVisibility / 10)}/10`} />
            <div className="condition-label">Visibilité</div>
          </div>
          <div className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24"><path d="M14 14.76V3.5a2 2 0 0 0-4 0v11.26a4 4 0 1 0 4 0z" /></svg>
            <AnimatedValue value={typeof weather?.temperature === "number" ? `${Math.round(weather.temperature)}°` : "—"} />
            <div className="condition-label">Temp.</div>
          </div>
          <div className="condition-item">
            <svg className="condition-icon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" /></svg>
            <AnimatedValue value={loadState === "ready" ? String(observableEntries.length) : "—"} />
            <div className="condition-label">Visibles</div>
          </div>
        </MotionBlock>

        <AnimatePresence mode="wait">{notice ? <motion.div key={notice} className="dashboard-notice" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>{notice}</motion.div> : null}</AnimatePresence>

        <MotionBlock className="camera-guide">
          <div className="camera-guide-inner">
            <motion.div className="camera-icon" animate={prefersReducedMotion ? undefined : { boxShadow: ["0 0 0 rgba(124,92,255,0)", "0 0 28px rgba(124,92,255,.22)", "0 0 0 rgba(124,92,255,0)"] }} transition={{ duration: 3, repeat: Infinity }}>
              <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
            </motion.div>
            <h3>{position ? "Le ciel t'attend ce soir" : "Découvre ton ciel maintenant"}</h3>
            <p>{position ? `${observableEntries.length} objet${observableEntries.length > 1 ? "s" : ""} observable${observableEntries.length > 1 ? "s" : ""} selon ta position et les conditions actuelles.` : "Autorise la position pour calculer les objets réellement visibles et préparer tes quêtes."}</p>
            <motion.button type="button" className="camera-btn" onClick={handleCameraAction} disabled={loadState === "loading" || isAdLoading} whileHover={prefersReducedMotion ? undefined : { y: -2 }} whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}>
              <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
              {loadState === "loading" ? "Lecture du ciel…" : visibleQuests.some((quest) => quest.targetType !== "free_observation") ? "Ouvrir le guidage" : "Lire le ciel"}
            </motion.button>
          </div>
        </MotionBlock>

        <MotionBlock className="section-header">
          <h2 className="section-title">Quêtes du soir</h2>
          <button type="button" className={`status-pill ${loadState === "loading" ? "loading" : ""}`} onClick={handleRefreshRequest} disabled={loadState === "loading"} title="Actualiser les conditions">
            <span className="dot" />{loadState === "loading" ? "Calcul…" : conditionsLabel}
          </button>
        </MotionBlock>

        <motion.div className="quest-list" variants={rootVariants}>
          <AnimatePresence mode="popLayout">
            {visibleQuests.map((quest) => <QuestCard key={quest.id} quest={quest} onStart={handleStart} />)}
          </AnimatePresence>
        </motion.div>
        {loadState === "idle" ? <MotionBlock className="empty-state"><svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" /></svg><p>Appuie sur « Lire le ciel » pour générer tes quêtes.</p></MotionBlock> : null}

        <section id="objects">
          <MotionBlock className="section-header spaced"><h2 className="section-title">Objets observables</h2><span className="section-sub">Planètes et catalogue</span></MotionBlock>
          <motion.div className="upcoming-list" variants={rootVariants}>
            {visibleObjects.map((object) => (
              <motion.div key={object.id} className="upcoming-item" variants={itemVariants} whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}>
                <div className="upcoming-date"><AnimatePresence mode="wait" initial={false}><motion.div className="day" key={Math.round(object.altitude)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{Math.round(object.altitude)}°</motion.div></AnimatePresence><div className="month">Alt.</div></div>
                <div className="upcoming-info"><h4>{object.name}</h4><p>{object.type} · {azimuthToCardinal(object.azimuth)} · {object.score}/100</p></div>
                <svg className="upcoming-arrow" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
              </motion.div>
            ))}
          </motion.div>
          {loadState === "ready" && visibleObjects.length === 0 ? <div className="empty-state"><p>Aucun objet suffisamment fiable maintenant. Une observation libre reste possible.</p></div> : null}
        </section>

        <section id="upcoming">
          <MotionBlock className="section-header spaced"><h2 className="section-title">Prochains événements</h2><span className="section-sub">Dans les 60 jours</span></MotionBlock>
          <motion.div className="upcoming-list" variants={rootVariants} initial="hidden" animate="visible">
            {eventTimeline.map((event) => {
              const localDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(event.date);
              const [day, ...monthParts] = localDate.replace(".", "").split(" ");
              const localTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(event.date);
              const timing = event.timeLabel === "approximate_peak"
                ? "Pic approximatif"
                : event.timeLabel === "peak"
                  ? `Pic à ${localTime}`
                  : `À ${localTime}`;

              return (
                <motion.article key={event.id} className="upcoming-item" variants={itemVariants} whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}>
                  <div className="upcoming-date"><div className="day">{day}</div><div className="month">{monthParts.join(" ")}</div></div>
                  <div className="upcoming-info"><h4>{event.title}</h4><p>{timing} · {event.description}</p></div>
                  <svg className="upcoming-arrow event-star" viewBox="0 0 24 24"><path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2z" /></svg>
                </motion.article>
              );
            })}
          </motion.div>
        </section>

        <section id="observation-windows">
          <MotionBlock className="section-header spaced"><h2 className="section-title">Fenêtres d&apos;observation</h2><span className="section-sub">Quêtes à venir</span></MotionBlock>
          <motion.div className="upcoming-list" variants={rootVariants}>
            {futureSuggestions.slice(0, 3).map((suggestion) => {
              const date = new Date(suggestion.availableAt);
              return (
                <motion.button key={`${suggestion.quest.id}-${suggestion.availableAt}`} type="button" className="upcoming-item" variants={itemVariants} whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }} onClick={() => handleStart(suggestion.quest)}>
                  <div className="upcoming-date"><div className="day">{date.getDate()}</div><div className="month">{new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date)}</div></div>
                  <div className="upcoming-info"><h4>{suggestion.quest.title}</h4><p>{new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date)} · visibilité {suggestion.quest.visibilityScore}/100</p></div>
                  <svg className="upcoming-arrow" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
                </motion.button>
              );
            })}
          </motion.div>
        </section>

        <section id="journal">
          <MotionBlock className="section-header spaced"><h2 className="section-title">Journal</h2><span className="section-sub">Tes observations</span></MotionBlock>
          <MotionBlock className="journal-preview">
            {recentObservations.map((observation) => (
              <Link href="/journal" className="journal-card" key={observation.id}>
                <div className="date">{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(observation.createdAt))}</div>
                <h4>{observation.questTitle}</h4>
                <p>{observation.status === "seen" ? `Observation confirmée · +${observation.xpEarned ?? 0} XP` : "Cible non aperçue · résultat enregistré"}</p>
              </Link>
            ))}
            <Link href="/journal" className="journal-card empty"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg><span>{recentObservations.length ? "Voir le journal" : "Première observation"}</span></Link>
          </MotionBlock>
        </section>

        <section id="progression">
          <MotionBlock className="section-header spaced"><h2 className="section-title">Progression</h2><span className="section-sub">{unlockedAchievementCount}/{achievementProgress.length || 7} succès</span></MotionBlock>
          <MotionBlock className="progress-card">
            <div className="progress-top"><div className="progress-rank">{rank?.current.name ?? "Curieux du ciel"}</div><div className="progress-xp">{profile?.totalXp ?? 0} XP</div></div>
            <div className="progress-track"><motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${rank?.progressPercent ?? 0}%` }} transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: "easeOut" }} /></div>
            <div className="progress-meta"><span>{profile?.currentStreak ?? 0} nuit{profile?.currentStreak === 1 ? "" : "s"} de suite</span><span>{rank?.next ? `${rank.xpToNext} XP avant ${rank.next.name}` : "Rang maximum"}</span></div>
          </MotionBlock>
        </section>
      </motion.main>

      <nav className="bottom-nav" aria-label="Navigation principale">
        <div className="bottom-nav-inner">
          <a className="nav-item active" href="#dashboard-top"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2" /></svg>Maintenant</a>
          <a className="nav-item" href="#objects"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>Explorer</a>
          <Link className="nav-item" href="/journal"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>Journal</Link>
          <a className="nav-item" href="#progression"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.18 19.73l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.17 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.27 7.18l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.18l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.83 10H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" /></svg>Profil</a>
        </div>
      </nav>
    </div>
  );
}
