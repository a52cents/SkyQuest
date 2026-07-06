"use client";

import { useEffect, useState } from "react";
import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { NotificationSettings } from "@/components/NotificationSettings";
import { TargetWatchSettings } from "@/components/TargetWatchSettings";
import {
  getExistingPushSubscription,
  getNotificationPreferences,
  isIosDevice,
  isPushSupported,
  isStandaloneDisplay,
  sendTestPush,
  subscribeToPush,
  syncPushPreferences,
  unsubscribeFromPush,
  type NotificationPreferences,
} from "@/lib/push-client";
import { getLastLocation } from "@/lib/storage";

type PushState = "checking" | "unsupported" | "ios-browser" | "idle" | "active" | "denied";

const STATE_LABELS: Record<Exclude<PushState, "checking">, string> = {
  unsupported: "Non disponible",
  "ios-browser": "Installation requise",
  idle: "Disponibles · désactivées",
  active: "Activées",
  denied: "Bloquées",
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function AlertIcon({ active }: { active: boolean }) {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border ${active ? "border-success/25 bg-success/[0.08] text-success" : "border-accent/25 bg-accent/[0.09] text-accent-cyan"}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5.5 w-5.5 fill-none stroke-current"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    </div>
  );
}

export function PushPermissionCard({ className }: { className?: string }) {
  const [state, setState] = useState<PushState>("checking");
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    getNotificationPreferences(),
  );
  const [isBusy, setIsBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const inspect = async () => {
      if (!isPushSupported()) {
        if (!disposed) setState("unsupported");
        return;
      }
      if (isIosDevice() && !isStandaloneDisplay()) {
        if (!disposed) setState("ios-browser");
        return;
      }
      if (Notification.permission === "denied") {
        if (!disposed) setState("denied");
        return;
      }
      const subscription = await getExistingPushSubscription();
      if (subscription) {
        await syncPushPreferences(getNotificationPreferences(), getLastLocation());
      }
      if (!disposed) setState(subscription ? "active" : "idle");
    };
    void inspect();
    return () => {
      disposed = true;
    };
  }, []);

  const enable = async () => {
    setIsBusy(true);
    setMessage(null);
    const subscription = await subscribeToPush({
      preferences,
      location: getLastLocation(),
    });
    if (subscription) {
      setState("active");
      setMessage("Alertes activées sur cet appareil.");
    } else if (Notification.permission === "denied") {
      setState("denied");
    } else {
      setMessage(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          ? "L’activation n’a pas abouti. Vérifie ta connexion puis réessaie."
          : "Les alertes ne sont pas encore configurées sur ce déploiement.",
      );
    }
    setIsBusy(false);
  };

  const disable = async () => {
    setIsBusy(true);
    setMessage(null);
    const success = await unsubscribeFromPush();
    setIsBusy(false);
    if (success) {
      setState("idle");
      setShowSettings(false);
      setMessage("Alertes désactivées sur cet appareil.");
    } else {
      setMessage("Impossible de désactiver les alertes pour le moment.");
    }
  };

  const updatePreferences = async (next: NotificationPreferences) => {
    setPreferences(next);
    setIsBusy(true);
    setMessage(null);
    const synced = await syncPushPreferences(next, getLastLocation());
    setIsBusy(false);
    setMessage(
      synced
        ? "Préférences enregistrées."
        : "Préférences gardées ici ; synchronisation à réessayer.",
    );
  };

  const sendTest = async () => {
    setIsBusy(true);
    setMessage(null);
    const subscription = await getExistingPushSubscription();
    try {
      const responseOk = subscription ? await sendTestPush() : false;
      setMessage(
        responseOk
          ? "Notification de test envoyée."
          : "La notification de test n’a pas pu être envoyée.",
      );
    } catch {
      setMessage("La notification de test n’a pas pu être envoyée.");
    }
    setIsBusy(false);
  };

  if (state === "checking") return null;

  const isActive = state === "active";
  const enabledTopicCount = Object.values(preferences).filter(Boolean).length;
  const title =
    state === "active"
      ? "Alertes du ciel activées"
      : state === "unsupported"
        ? "Notifications non disponibles"
        : state === "ios-browser"
          ? "Installe SkyQuest pour les alertes"
          : state === "denied"
            ? "Notifications bloquées"
            : "Active les alertes du ciel";

  return (
    <AppCard
      as="section"
      variant="glass"
      padding="md"
      className={joinClasses("overflow-hidden", className)}
      aria-labelledby="push-card-title"
    >
      <div className="flex items-start gap-3.5">
        <AlertIcon active={isActive} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="push-card-title" className="m-0 text-base font-semibold text-text">
              {title}
            </h2>
            <span
              className={joinClasses(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.68rem] font-semibold",
                isActive
                  ? "bg-success/[0.08] text-success"
                  : state === "denied"
                    ? "bg-warning/[0.08] text-warning"
                    : "bg-white/[0.05] text-muted",
              )}
            >
              <span
                className={joinClasses(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-success" : state === "denied" ? "bg-warning" : "bg-faint",
                )}
              />
              {STATE_LABELS[state]}
            </span>
          </div>
          <p className="mt-1.5 mb-0 text-sm leading-5 text-muted">
            {isActive
              ? "SkyQuest te préviendra lorsqu’une occasion intéressante se présente."
              : "Lune, planète ou ciel clair : reçois une alerte quand le moment semble bon."}
          </p>
        </div>
      </div>

      {state === "unsupported" ? (
        <p className="mt-4 mb-0 rounded-[14px] bg-white/[0.04] p-3 text-sm leading-5 text-muted">
          Les notifications ne sont pas disponibles dans ce navigateur.
        </p>
      ) : null}

      {state === "ios-browser" ? (
        <p className="mt-4 mb-0 rounded-[14px] bg-white/[0.04] p-3 text-sm leading-5 text-muted">
          Sur iPhone, ajoute d’abord SkyQuest à l’écran d’accueil, puis ouvre l’app installée.
        </p>
      ) : null}

      {state === "denied" ? (
        <p className="mt-4 mb-0 rounded-[14px] border border-warning/20 bg-warning/[0.06] p-3 text-sm leading-5 text-muted">
          Les notifications sont bloquées. Réactive-les dans les réglages du navigateur.
        </p>
      ) : null}

      {state === "idle" ? (
        <div className="mt-4">
          <AppButton fullWidth isLoading={isBusy} onClick={() => void enable()}>
            Activer les alertes
          </AppButton>
        </div>
      ) : null}

      {isActive ? (
        <>
          <button
            type="button"
            aria-expanded={showSettings}
            aria-controls="notification-settings"
            onClick={() => setShowSettings((current) => !current)}
            className="mt-4 flex min-h-12 w-full items-center justify-between gap-4 rounded-[15px] border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-text">
                {enabledTopicCount} type{enabledTopicCount > 1 ? "s" : ""} d’alerte
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Personnaliser les notifications
              </span>
            </span>
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 shrink-0 fill-none stroke-current text-muted transition-transform ${showSettings ? "rotate-180" : ""}`}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m7 10 5 5 5-5" />
            </svg>
          </button>

          {showSettings ? (
            <div id="notification-settings">
              <NotificationSettings
                preferences={preferences}
                disabled={isBusy}
                onChange={(next) => void updatePreferences(next)}
                onDisable={() => void disable()}
              />
              <TargetWatchSettings />
              {process.env.NODE_ENV !== "production" ? (
                <AppButton
                  variant="ghost"
                  size="sm"
                  fullWidth
                  disabled={isBusy}
                  className="mt-3"
                  onClick={() => void sendTest()}
                >
                  Envoyer une notification de test
                </AppButton>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {message ? (
        <p aria-live="polite" className="mt-3 mb-0 text-sm leading-5 text-accent-cyan">
          {message}
        </p>
      ) : null}

      {state === "idle" ? (
        <div className="mt-3 flex items-center gap-2 text-xs leading-4 text-muted">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 fill-none stroke-current text-accent-cyan"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          </svg>
          Position approximative uniquement · désactivation à tout moment
        </div>
      ) : null}
      {isActive ? (
        <p className="mt-3 mb-0 text-xs leading-5 text-muted">
          Sans compte. Seuls tes thèmes et une zone approximative servent à choisir les alertes.
        </p>
      ) : null}
    </AppCard>
  );
}
