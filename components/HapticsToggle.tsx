"use client";

import { useHaptics } from "@/hooks/useHaptics";

function VibrationIcon({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0">
      <path
        d="M7 9h10v6H7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5 10.5V13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M19 10.5V13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M3.5 8.5V15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M20.5 8.5V15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0">
      <path
        d="M7 9h10v6H7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M4 4l16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HapticsToggle() {
  const { isEnabled, setEnabled, isSupported } = useHaptics();

  function handleToggle() {
    if (!isSupported) {
      return;
    }

    setEnabled(!isEnabled);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!isSupported}
      aria-disabled={!isSupported}
      aria-pressed={isSupported ? isEnabled : false}
      aria-label={
        isSupported
          ? isEnabled
            ? "Désactiver les haptiques"
            : "Activer les haptiques"
          : "Haptiques non supportées sur cet appareil"
      }
      title={
        isSupported
          ? isEnabled
            ? "Haptiques activées"
            : "Haptiques désactivées"
          : "Haptiques non supportées sur cet appareil"
      }
      className={
        isSupported
          ? isEnabled
            ? "inline-flex h-10 items-center gap-2 rounded-[13px] border border-accent/30 bg-accent/10 px-3 text-sm font-semibold text-accent transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-accent/45 hover:bg-accent/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            : "inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/10 bg-white/[0.045] px-3 text-sm font-semibold text-muted transition-[background-color,border-color,color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-white/20 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : "inline-flex h-10 items-center gap-2 rounded-[13px] border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-muted opacity-55"
      }
    >
      <span className={isSupported ? (isEnabled ? "text-accent" : "text-muted") : "text-muted"}>
        <VibrationIcon enabled={isSupported && isEnabled} />
      </span>
      <span className="hidden sm:inline">Haptique</span>
    </button>
  );
}
