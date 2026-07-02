const ONBOARDING_KEY = "skyquest.onboarding.v1";
const ONBOARDING_DONE = "done";

export function getOnboardingCompleted(): boolean {
  // The onboarding must never prevent access to the app when storage is blocked.
  if (typeof window === "undefined") return true;
  try {
    const value = window.localStorage.getItem(ONBOARDING_KEY);
    return value === ONBOARDING_DONE || value === "completed";
  } catch {
    return true;
  }
}

export function setOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, ONBOARDING_DONE);
  } catch {
    // The app still works if localStorage is blocked.
  }
}

export function resetOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // Resetting this optional preference must not make the app fail.
  }
}

/** @deprecated Use getOnboardingCompleted. */
export const isOnboardingCompleted = getOnboardingCompleted;
