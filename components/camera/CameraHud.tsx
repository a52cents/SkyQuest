import Link from "next/link";
import type { ReactNode } from "react";
import { AppButton, getAppButtonClassName } from "@/components/AppButton";
import { NightModeToggle } from "@/components/NightModeToggle";
import type { SkyQuest } from "@/lib/types";
import { getGearLabel } from "./camera-utils";
import { CameraDirectionHint } from "./CameraDirectionHint";
import type { CameraGuidanceState, OrientationConfidence, OrientationStatus } from "./types";

type CameraHudProps = {
  quest: SkyQuest;
  guidance: CameraGuidanceState;
  orientation: { status: OrientationStatus; confidence: OrientationConfidence };
  onOpenDetails: () => void;
  children: ReactNode;
};

export function CameraHud({
  quest,
  guidance,
  orientation,
  onOpenDetails,
  children,
}: CameraHudProps) {
  return (
    <>
      <CameraDirectionHint targetId={quest.target} title={quest.title} guidance={guidance} />
      <section className="camera-guide-safe-area relative z-10 flex h-[100dvh] flex-col justify-between">
        <header
          data-camera-control
          className="flex min-h-14 items-center gap-2 rounded-[20px] border border-white/[0.08] bg-[#0a0a0b]/75 px-2 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-[24px]"
        >
          <Link
            href="/"
            aria-label="Quitter"
            className={getAppButtonClassName({
              variant: "ghost",
              size: "sm",
              className: "min-h-0 h-10 w-10 px-0 text-lg",
            })}
          >
            ←
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-[Georgia,'Times_New_Roman',serif] text-base font-normal tracking-[-0.02em] text-white">
            {quest.title}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <AppButton
              variant="ghost"
              size="sm"
              onClick={onOpenDetails}
              className="h-10 min-h-0 border-white/10 bg-white/[0.06] px-3 text-white"
            >
              Détails
            </AppButton>
            <NightModeToggle />
          </div>
        </header>
        <div className="pointer-events-none absolute left-4 right-4 top-[calc(env(safe-area-inset-top)+5rem)] flex flex-col items-center gap-3">
          <p className="rounded-[16px] border border-white/[0.08] bg-[#0a0a0b]/75 px-5 py-3 text-center font-[Georgia,'Times_New_Roman',serif] text-lg font-normal shadow-[0_12px_42px_rgba(0,0,0,0.25)] backdrop-blur-[24px]">
            {guidance.mainHint}
          </p>
          {orientation.status === "active" && orientation.confidence === "medium" ? (
            <p className="rounded-full border border-warning/20 bg-[#0a0a0b]/75 px-3 py-2 text-center text-xs font-semibold text-warning backdrop-blur-xl">
              Boussole imprécise — utilise surtout la direction indiquée.
            </p>
          ) : null}
          <div className="flex max-w-full flex-wrap justify-center gap-2">
            {[
              quest.cardinalDirection ?? "Zone libre",
              guidance.targetAltitudeLabel,
              getGearLabel(quest),
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/10 bg-background/45 px-3 py-2 text-sm font-bold text-white backdrop-blur-xl"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        {children}
      </section>
    </>
  );
}
