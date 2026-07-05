import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { AppButton } from "@/components/AppButton";
import { CameraFallback } from "./CameraFallback";
import { CameraZoomControl } from "./CameraZoomControl";
import type { CameraStatus, CameraZoomRange, GuidanceReliability } from "./types";

type CameraControlsProps = {
  camera: { status: CameraStatus; error: string | null };
  zoom: { range: CameraZoomRange | null; value: number | null; error: string | null };
  submitting: boolean;
  nativePhotoError: string | null;
  guidanceReliability: GuidanceReliability;
  isCalibrated: boolean;
  onZoomChange: (value: number) => void;
  onFound: () => void;
  onMissed: () => void;
  onPhoto: () => void;
  onStartCamera: () => void;
  onRecalibrate: () => void;
};

const RELIABILITY_LABELS: Record<GuidanceReliability, string> = {
  reliable: "Guidage fiable",
  approximate: "Guidage approximatif",
  text_recommended: "Guidage texte conseillé",
};

export function CameraControls({
  camera,
  zoom,
  submitting,
  nativePhotoError,
  guidanceReliability,
  isCalibrated,
  onZoomChange,
  onFound,
  onMissed,
  onPhoto,
  onStartCamera,
  onRecalibrate,
}: CameraControlsProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const variants: Variants = reducedMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, y: -10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.18 } },
        exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
      };

  return (
    <div
      data-camera-control
      className="rounded-[20px] border border-white/[0.08] bg-[#0a0a0b]/80 p-3 shadow-[0_-12px_44px_rgba(0,0,0,0.28)] backdrop-blur-[24px]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
            guidanceReliability === "reliable"
              ? "border-success/25 bg-success/10 text-success"
              : guidanceReliability === "approximate"
                ? "border-warning/25 bg-warning/10 text-warning"
                : "border-white/10 bg-white/[0.05] text-muted"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {RELIABILITY_LABELS[guidanceReliability]}
          {isCalibrated ? " · corrigé" : ""}
        </span>
        <AppButton
          variant="ghost"
          size="sm"
          onClick={onRecalibrate}
          className="h-9 min-h-0 shrink-0 px-3 text-xs"
        >
          Recalibrer
        </AppButton>
      </div>
      <CameraFallback cameraError={camera.error} zoomError={zoom.error} />
      {nativePhotoError ? (
        <p className="mb-3 rounded-brand border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
          {nativePhotoError}
        </p>
      ) : null}
      {camera.status === "active" && zoom.range && zoom.value !== null ? (
        <CameraZoomControl range={zoom.range} value={zoom.value} onChange={onZoomChange} />
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <AppButton
          variant="success"
          size="sm"
          onClick={onFound}
          className="min-h-12"
          disabled={submitting}
          hapticFeedback={false}
        >
          Je l&apos;ai trouvée
        </AppButton>
        <AppButton
          variant="ghost"
          size="sm"
          onClick={onMissed}
          className="min-h-12"
          disabled={submitting}
          hapticFeedback={false}
        >
          Pas trouvé
        </AppButton>
      </div>
      <AppButton
        variant="secondary"
        size="sm"
        onClick={onPhoto}
        fullWidth
        className="mt-2 min-h-12"
        disabled={submitting}
      >
        <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>📷 Ajouter une photo souvenir</span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted">
            Optionnel
          </span>
        </span>
      </AppButton>
      {camera.status !== "active" ? (
        <AppButton
          variant="secondary"
          onClick={onStartCamera}
          disabled={camera.status === "starting"}
          fullWidth
          className="mt-2 min-h-12"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={camera.status === "starting" ? "camera-starting" : "camera-idle"}
              variants={variants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="inline-flex items-center gap-1 rounded-full px-1 text-sm font-semibold"
            >
              {camera.status === "starting" ? "Ouverture…" : "Ouvrir l'appareil photo"}
            </motion.span>
          </AnimatePresence>
        </AppButton>
      ) : null}
    </div>
  );
}
