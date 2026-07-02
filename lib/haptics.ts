export type HapticPattern =
  "tap" | "select" | "align" | "success" | "missed" | "achievement" | "rank-up" | "error";

const HAPTICS_STORAGE_KEY = "skyquest.haptics.v1";

const HAPTIC_PATTERNS: Record<HapticPattern, number[]> = {
  tap: [8],
  select: [12],
  align: [10, 40, 10],
  success: [20, 50, 30],
  missed: [60],
  achievement: [15, 40, 15, 40, 60],
  "rank-up": [20, 60, 20, 60, 20, 120],
  error: [40, 30, 40],
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readPreference(): "on" | "off" | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const value = window.localStorage.getItem(HAPTICS_STORAGE_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

export function isHapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function isHapticsEnabled(): boolean {
  const stored = readPreference();
  if (stored) {
    return stored === "on";
  }

  return isHapticsSupported();
}

export function setHapticsEnabled(enabled: boolean): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    return;
  }
}

export function haptic(pattern: HapticPattern): void {
  if (!isHapticsSupported() || !isHapticsEnabled()) {
    return;
  }

  try {
    navigator.vibrate(HAPTIC_PATTERNS[pattern]);
  } catch {
    return;
  }
}
