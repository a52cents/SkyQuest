"use client";

import { useEffect, useRef, useState } from "react";
import { applyNightModeFromStorage, isNightMode, toggleNightMode } from "@/lib/night-mode";

const DAY_THEME_COLOR = "#0a0a0b";
const NIGHT_THEME_COLOR = "#1a0000";

function setThemeColorMeta(enabled: boolean): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = enabled ? NIGHT_THEME_COLOR : DAY_THEME_COLOR;
  }
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0">
      <path
        d="M16.8 14.3A8 8 0 0 1 9.7 5a7.8 7.8 0 1 0 11.1 11.1 8 8 0 0 1-4-1.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClosedEyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0">
      <path
        d="M3.5 12s2.9-5.5 8.5-5.5 8.5 5.5 8.5 5.5-2.9 5.5-8.5 5.5S3.5 12 3.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 8.8 15.8 16.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M15.8 8.8 8.2 16.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NightModeToggle() {
  const [enabled, setEnabled] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    applyNightModeFromStorage();
    setEnabled(isNightMode());
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    setThemeColorMeta(enabled);
  }, [enabled]);

  function handleToggle() {
    const nextEnabled = toggleNightMode();
    setEnabled(nextEnabled);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={enabled}
      aria-label="Activer le mode observation (préserve la vision de nuit)"
      className={
        enabled
          ? "inline-flex h-11 items-center gap-2 rounded-brand border border-danger/30 bg-danger/12 px-3 text-sm font-semibold text-danger transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-danger/40 hover:bg-danger/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : "inline-flex h-11 items-center gap-2 rounded-brand border border-white/10 bg-white/[0.045] px-3 text-sm font-semibold text-muted transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-white/20 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      }
    >
      <span className={enabled ? "text-danger" : "text-muted"}>
        {enabled ? <ClosedEyeIcon /> : <MoonIcon />}
      </span>
      <span className="hidden sm:inline">{enabled ? "Observation" : "Nuit"}</span>
    </button>
  );
}
