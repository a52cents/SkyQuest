import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { FixedSkyGuide } from "@/components/FixedSkyGuide";
import type { CameraGuidanceState } from "./types";

type CameraDirectionHintProps = {
  targetId: string;
  title: string;
  guidance: CameraGuidanceState;
};

export function CameraDirectionHint({ targetId, title, guidance }: CameraDirectionHintProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const variants: Variants = reducedMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, scale: 0.85, y: 4 },
        show: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { type: "spring", stiffness: 700, damping: 40 },
        },
        exit: { opacity: 0, scale: 0.9, y: -2, transition: { duration: 0.15 } },
      };
  const horizontalClass =
    guidance.directionArrow === "→"
      ? "absolute -right-9 text-5xl font-black text-white drop-shadow-xl"
      : "absolute -left-9 text-5xl font-black text-white drop-shadow-xl";
  const verticalClass =
    guidance.altitudeArrow === "↑"
      ? "absolute -top-11 text-4xl font-black text-accent-cyan drop-shadow-xl"
      : "absolute -bottom-11 text-4xl font-black text-accent-cyan drop-shadow-xl";

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-[11] -translate-x-1/2 -translate-y-1/2">
      <div className="relative flex h-40 w-52 items-center justify-center">
        <FixedSkyGuide
          targetId={targetId}
          hasPrecisePoint={guidance.hasPrecisePoint}
          aligned={guidance.isAligned}
        />
        <AnimatePresence mode="wait" initial={false}>
          {guidance.directionArrow === "→" || guidance.directionArrow === "←" ? (
            <motion.span
              key={guidance.directionArrow}
              variants={variants}
              initial="hidden"
              animate="show"
              exit="exit"
              className={horizontalClass}
            >
              {guidance.directionArrow}
            </motion.span>
          ) : null}
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          {guidance.altitudeArrow === "↑" || guidance.altitudeArrow === "↓" ? (
            <motion.span
              key={guidance.altitudeArrow}
              variants={variants}
              initial="hidden"
              animate="show"
              exit="exit"
              className={verticalClass}
            >
              {guidance.altitudeArrow}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <span
        className={`absolute left-1/2 top-[calc(100%+0.75rem)] max-w-[76vw] -translate-x-1/2 truncate whitespace-nowrap rounded-full border px-3 py-1.5 text-center text-xs font-bold backdrop-blur-xl ${guidance.isAligned ? "border-success/30 bg-success/15 text-success" : "border-accent-cyan/30 bg-[#0a0a0b]/75 text-accent-cyan"}`}
      >
        Repère : {title}
      </span>
    </div>
  );
}
