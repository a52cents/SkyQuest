import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { MAX_HORIZONTAL_CALIBRATION_DEGREES } from "./camera-utils";
import type { GuidanceReliability } from "./types";

const RELIABILITY_COPY: Record<GuidanceReliability, string> = {
  reliable: "Le capteur fournit un cap absolu. Ajuste seulement si le repère reste décalé.",
  approximate:
    "La boussole peut dériver. Utilise un repère que tu reconnais pour corriger doucement.",
  text_recommended:
    "Aucun cap horizontal exploitable. La correction manuelle ne peut pas remplacer les indications texte.",
};

export function CameraCalibrationPanel({
  open,
  horizontalOffset,
  reliability,
  onOffsetChange,
  onReset,
  onClose,
}: {
  open: boolean;
  horizontalOffset: number;
  reliability: GuidanceReliability;
  onOffsetChange: (offset: number) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const canCalibrate = reliability !== "text_recommended";
  const offsetLabel =
    horizontalOffset === 0 ? "Centré" : `${horizontalOffset > 0 ? "+" : ""}${horizontalOffset}°`;

  return (
    <div
      data-camera-control
      className="camera-guide-details-safe-area fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibration-title"
    >
      <AppCard
        className="mx-auto w-full max-w-[600px] select-text rounded-t-[20px] rounded-b-none pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        padding="lg"
      >
        <p className="premium-kicker">Correction temporaire</p>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div>
            <h2
              id="calibration-title"
              className="font-[Georgia,'Times_New_Roman',serif] text-2xl font-normal text-white"
            >
              Recaler le repère
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">{RELIABILITY_COPY[reliability]}</p>
          </div>
          <span className="shrink-0 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-1.5 text-sm font-bold text-accent-cyan">
            {offsetLabel}
          </span>
        </div>

        <div className="mt-6 rounded-brand-lg border border-white/10 bg-white/[0.035] p-4">
          <label htmlFor="horizontal-calibration" className="text-sm font-bold text-white">
            Décalage horizontal
          </label>
          <p className="mt-1 text-xs leading-5 text-muted">
            Déplace le repère vers la gauche ou la droite jusqu’à ce qu’il corresponde à la
            direction que tu reconnais.
          </p>
          <input
            id="horizontal-calibration"
            type="range"
            min={-MAX_HORIZONTAL_CALIBRATION_DEGREES}
            max={MAX_HORIZONTAL_CALIBRATION_DEGREES}
            step={1}
            value={horizontalOffset}
            disabled={!canCalibrate}
            onChange={(event) => onOffsetChange(Number(event.target.value))}
            className="mt-5 h-11 w-full accent-accent disabled:cursor-not-allowed disabled:opacity-35"
          />
          <div className="flex justify-between text-[11px] font-semibold text-faint">
            <span>← Gauche</span>
            <span>Centre</span>
            <span>Droite →</span>
          </div>
          {canCalibrate ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <AppButton
                variant="ghost"
                size="sm"
                onClick={() =>
                  onOffsetChange(
                    Math.max(-MAX_HORIZONTAL_CALIBRATION_DEGREES, horizontalOffset - 5),
                  )
                }
              >
                5° à gauche
              </AppButton>
              <AppButton
                variant="ghost"
                size="sm"
                onClick={() =>
                  onOffsetChange(Math.min(MAX_HORIZONTAL_CALIBRATION_DEGREES, horizontalOffset + 5))
                }
              >
                5° à droite
              </AppButton>
            </div>
          ) : (
            <p className="mt-4 rounded-brand border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
              Suis la direction cardinale et la hauteur affichées plutôt que le repère caméra.
            </p>
          )}
        </div>

        <p className="mt-4 text-xs leading-5 text-faint">
          Cette correction reste sur cet écran et sera oubliée en quittant la quête.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <AppButton variant="ghost" onClick={onReset} disabled={horizontalOffset === 0}>
            Réinitialiser
          </AppButton>
          <AppButton onClick={onClose}>Terminer</AppButton>
        </div>
      </AppCard>
    </div>
  );
}
