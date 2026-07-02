"use client";

import { useEffect, useState } from "react";
import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { NotificationSettings } from "@/components/NotificationSettings";
import {
  getExistingPushSubscription,
  getNotificationPreferences,
  isIosDevice,
  isPushSupported,
  isStandaloneDisplay,
  subscribeToPush,
  syncPushPreferences,
  unsubscribeFromPush,
  type NotificationPreferences,
} from "@/lib/push-client";
import { getLastLocation } from "@/lib/storage";

type PushState = "checking" | "unsupported" | "ios-browser" | "idle" | "active" | "denied";

export function PushPermissionCard() {
  const [state, setState] = useState<PushState>("checking");
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    getNotificationPreferences(),
  );
  const [isBusy, setIsBusy] = useState(false);
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
        // Re-register after a server restart; this does not ask for permission again.
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
      setMessage("Les alertes sont prêtes sur cet appareil.");
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
      setMessage("Les alertes ont été désactivées sur cet appareil.");
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
        : "Préférences gardées sur cet appareil ; synchronisation à réessayer.",
    );
  };

  const sendTest = async () => {
    setIsBusy(true);
    setMessage(null);
    const subscription = await getExistingPushSubscription();
    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription?.endpoint }),
      });
      setMessage(
        response.ok
          ? "Notification de test envoyée."
          : "La notification de test n’a pas pu être envoyée.",
      );
    } catch {
      setMessage("La notification de test n’a pas pu être envoyée.");
    }
    setIsBusy(false);
  };

  if (state === "checking") return null;

  return (
    <AppCard as="section" variant="glass" className="my-8" aria-labelledby="push-card-title">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-2xl"
          aria-hidden="true"
        >
          ✦
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="push-card-title" className="m-0 text-lg font-semibold text-text">
            Active les alertes du ciel
          </h2>
          <p className="mt-2 mb-0 text-sm leading-relaxed text-muted">
            Reçois une alerte rare quand la Lune, une planète ou une mission intéressante semble
            observable près de chez toi.
          </p>
        </div>
      </div>

      {state === "unsupported" ? (
        <p className="mt-4 mb-0 rounded-2xl bg-white/[0.04] p-3 text-sm text-muted">
          Les notifications push ne sont pas disponibles dans ce navigateur ou ce contexte.
        </p>
      ) : null}
      {state === "ios-browser" ? (
        <p className="mt-4 mb-0 rounded-2xl bg-white/[0.04] p-3 text-sm leading-relaxed text-muted">
          Sur iPhone, les notifications fonctionnent seulement si SkyQuest est ajoutée à l’écran
          d’accueil, sur iOS 16.4 ou plus récent.
        </p>
      ) : null}
      {state === "denied" ? (
        <p className="mt-4 mb-0 rounded-2xl border border-warning/20 bg-warning/[0.06] p-3 text-sm leading-relaxed text-muted">
          Les notifications sont bloquées. Tu peux les réautoriser dans les réglages du navigateur
          ou de l’appareil.
        </p>
      ) : null}
      {state === "idle" ? (
        <div className="mt-5">
          <AppButton fullWidth isLoading={isBusy} onClick={() => void enable()}>
            Activer les alertes
          </AppButton>
        </div>
      ) : null}
      {state === "active" ? (
        <>
          <NotificationSettings
            preferences={preferences}
            disabled={isBusy}
            onChange={(next) => void updatePreferences(next)}
            onDisable={() => void disable()}
          />
          {process.env.NODE_ENV !== "production" ? (
            <AppButton
              variant="ghost"
              size="sm"
              fullWidth
              disabled={isBusy}
              className="mt-4"
              onClick={() => void sendTest()}
            >
              Envoyer une notification de test
            </AppButton>
          ) : null}
        </>
      ) : null}

      {message ? (
        <p aria-live="polite" className="mt-4 mb-0 text-sm text-accent-cyan">
          {message}
        </p>
      ) : null}
      <p className="mt-4 mb-0 text-xs leading-relaxed text-faint">
        Les alertes utilisent ta position approximative pour savoir quoi observer près de toi. Tu
        peux les désactiver à tout moment. Une visibilité reste toujours une estimation.
      </p>
    </AppCard>
  );
}
