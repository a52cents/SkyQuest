import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import type { OrientationConfidence, OrientationStatus } from "./types";
import type { SkyQuest } from "@/lib/types";

export type CameraDetailsState = {
  currentAzimuth: number | null;
  currentAltitude: number | null;
  currentPhoneDirection: string;
  targetAltitudeLabel: string;
  directionArrowLabel: string;
  altitudeArrowLabel: string;
  zoomLabel: string;
  orientationStatus: OrientationStatus;
  orientationConfidence: OrientationConfidence;
  orientationError: string | null;
};

function DetailsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-1 text-base font-black text-white">{value}</p>
    </div>
  );
}

export function CameraDetailsPanel({
  open,
  quest,
  state,
  onClose,
}: {
  open: boolean;
  quest: SkyQuest;
  state: CameraDetailsState;
  onClose: () => void;
}) {
  if (!open) return null;
  const sensorLabel =
    state.orientationConfidence === "high"
      ? "Absolu"
      : state.orientationConfidence === "medium"
        ? "Boussole"
        : "Inclinaison";
  const rows = [
    [
      "Direction cible",
      `${quest.cardinalDirection ?? "Libre"}${quest.azimuth !== null ? ` ${Math.round(quest.azimuth)}°` : ""}`,
    ],
    [
      "Direction tel.",
      state.currentAzimuth !== null
        ? `${state.currentPhoneDirection} ${Math.round(state.currentAzimuth)}°`
        : "Inconnu",
    ],
    ["Hauteur cible", state.targetAltitudeLabel],
    [
      "Hauteur tel.",
      state.currentAltitude !== null ? `${Math.round(state.currentAltitude)}°` : "Inconnu",
    ],
    ["Delta direction", state.directionArrowLabel],
    ["Delta hauteur", state.altitudeArrowLabel],
    ["Zoom reel", state.zoomLabel],
    ["Orientation", state.orientationStatus === "active" ? "Active" : "Inactive"],
    ["Capteur", sensorLabel],
  ];
  return (
    <div
      data-camera-control
      className="camera-guide-details-safe-area fixed inset-0 z-40 flex items-end bg-black/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="details-title"
    >
      <AppCard
        className="mx-auto max-h-[82dvh] w-full max-w-[600px] select-text overflow-y-auto rounded-t-[20px] rounded-b-none pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        padding="lg"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-cyan">
              Details
            </p>
            <h2
              id="details-title"
              className="mt-1 font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal text-white"
            >
              {quest.title}
            </h2>
          </div>
          <AppButton variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </AppButton>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {rows.map(([label, value]) => (
            <DetailsRow key={label} label={label} value={value} />
          ))}
        </div>
        <div className="mt-4 rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
          <p className="text-sm font-bold text-white">Conseil</p>
          <p className="mt-2 text-sm leading-6 text-muted">{quest.tip}</p>
        </div>
        <div className="mt-3 rounded-brand-lg border border-brand-border bg-white/[0.05] p-4">
          <p className="text-sm font-bold text-white">Boussole</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            La direction utilise la boussole du navigateur quand elle est disponible. Elle peut etre
            approximative dehors : suis aussi la direction texte et ton regard.
          </p>
          {state.orientationError ? (
            <p className="mt-2 text-sm text-warning">{state.orientationError}</p>
          ) : null}
        </div>
      </AppCard>
    </div>
  );
}
