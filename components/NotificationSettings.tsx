"use client";

import type { NotificationPreferences, NotificationTopic } from "@/lib/push-client";

const TOPIC_LABELS: Array<{ topic: NotificationTopic; title: string; description: string }> = [
  {
    topic: "clear_sky_evening",
    title: "Ciel clair",
    description: "Quand la météo semble favorable.",
  },
  {
    topic: "moon_visible",
    title: "Lune",
    description: "Quand elle est bien placée.",
  },
  {
    topic: "planet_visible",
    title: "Planètes",
    description: "Pour une planète accessible.",
  },
  {
    topic: "celestial_event",
    title: "Événements rares",
    description: "Éclipses et rendez-vous proches.",
  },
  {
    topic: "daily_mission",
    title: "Mission du soir",
    description: "Un rappel quand une mission est plausible.",
  },
];

export function NotificationSettings({
  preferences,
  disabled = false,
  onChange,
  onDisable,
}: {
  preferences: NotificationPreferences;
  disabled?: boolean;
  onChange: (preferences: NotificationPreferences) => void;
  onDisable: () => void;
}) {
  return (
    <div className="mt-4 border-t border-white/[0.08] pt-4">
      <div className="rounded-[16px] border border-accent/15 bg-accent/[0.055] px-4 py-3">
        <p className="m-0 text-sm font-semibold text-text">Fenêtre d’observation</p>
        <p className="mt-1 mb-0 text-xs leading-5 text-muted">
          De 19 h à 3 h · une alerte maximum par heure
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="m-0 text-sm font-semibold text-text">Types d’alertes</p>
          <p className="mt-1 mb-0 text-xs text-muted">Choisis ce qui mérite de te prévenir.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked="true"
          aria-label="Désactiver toutes les alertes"
          disabled={disabled}
          onClick={onDisable}
          className="relative h-7 w-12 shrink-0 rounded-full border border-accent/40 bg-accent disabled:opacity-60"
        >
          <span className="absolute top-0.5 right-0.5 h-6 w-6 rounded-full bg-white shadow" />
        </button>
      </div>

      <div className="mt-3 divide-y divide-white/[0.06]" aria-label="Types d’alertes">
        {TOPIC_LABELS.map(({ topic, title, description }) => (
          <label
            key={topic}
            className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2.5"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text">{title}</span>
              <span className="mt-0.5 block text-xs leading-4 text-muted">{description}</span>
            </span>
            <span className="relative shrink-0">
              <input
                type="checkbox"
                checked={preferences[topic]}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...preferences, [topic]: event.currentTarget.checked })
                }
                className="peer sr-only"
              />
              <span className="block h-6 w-10 rounded-full border border-white/10 bg-white/[0.08] transition-colors peer-checked:border-accent/40 peer-checked:bg-accent peer-disabled:opacity-60" />
              <span className="absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
