"use client";

import type { NotificationPreferences, NotificationTopic } from "@/lib/push-client";

const TOPIC_LABELS: Array<{ topic: NotificationTopic; title: string; description: string }> = [
  {
    topic: "clear_sky_evening",
    title: "Ciel clair",
    description: "Quand la météo semble favorable le soir.",
  },
  {
    topic: "moon_visible",
    title: "Lune",
    description: "Quand la Lune est bien placée.",
  },
  {
    topic: "planet_visible",
    title: "Planètes",
    description: "Pour une planète accessible maintenant ou bientôt.",
  },
  {
    topic: "celestial_event",
    title: "Événements rares",
    description: "Éclipses et rendez-vous célestes proches.",
  },
  {
    topic: "daily_mission",
    title: "Mission quotidienne",
    description: "Un rappel du soir si une mission est plausible.",
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
    <div className="mt-5 border-t border-white/[0.08] pt-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="m-0 font-semibold text-text">Alertes du ciel activées</p>
          <p className="mt-1 mb-0 text-sm text-muted">Une alerte maximum par jour.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked="true"
          aria-label="Désactiver toutes les alertes du ciel"
          disabled={disabled}
          onClick={onDisable}
          className="relative h-8 w-14 shrink-0 rounded-full border border-accent/50 bg-accent disabled:opacity-60"
        >
          <span className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white shadow" />
        </button>
      </div>

      <div className="grid gap-1" aria-label="Types d’alertes">
        {TOPIC_LABELS.map(({ topic, title, description }) => (
          <label
            key={topic}
            className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-2xl px-3 py-2 hover:bg-white/[0.035]"
          >
            <span>
              <span className="block text-sm font-medium text-text">{title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
            </span>
            <input
              type="checkbox"
              checked={preferences[topic]}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...preferences, [topic]: event.currentTarget.checked })
              }
              className="h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
