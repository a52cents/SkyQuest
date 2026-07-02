import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { AppButton } from "@/components/AppButton";
import { CameraFallback } from "./CameraFallback";
import { CameraZoomControl } from "./CameraZoomControl";
import type { CameraStatus, CameraZoomRange, PhotoCaptureStatus } from "./types";

type CameraControlsProps = {
  camera: { status: CameraStatus; error: string | null };
  zoom: { range: CameraZoomRange | null; value: number | null; error: string | null };
  photoStatus: PhotoCaptureStatus;
  onZoomChange: (value: number) => void;
  onFound: () => void;
  onMissed: () => void;
  onStartCamera: () => void;
};

export function CameraControls({
  camera,
  zoom,
  photoStatus,
  onZoomChange,
  onFound,
  onMissed,
  onStartCamera,
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
    <div className="rounded-[20px] border border-white/[0.08] bg-[#0a0a0b]/80 p-3 shadow-[0_-12px_44px_rgba(0,0,0,0.28)] backdrop-blur-[24px]">
      <CameraFallback cameraError={camera.error} zoomError={zoom.error} />
      {camera.status === "active" && zoom.range && zoom.value !== null ? (
        <CameraZoomControl range={zoom.range} value={zoom.value} onChange={onZoomChange} />
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <AppButton
          variant="success"
          size="sm"
          onClick={onFound}
          className="min-h-12"
          disabled={photoStatus === "capturing"}
        >
          {photoStatus === "capturing" ? "Photo..." : "Je l'ai trouvée"}
        </AppButton>
        <AppButton variant="ghost" size="sm" onClick={onMissed} className="min-h-12">
          Pas trouve
        </AppButton>
      </div>
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
