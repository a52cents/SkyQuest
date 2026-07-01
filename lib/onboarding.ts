const ONBOARDING_KEY = "skyquest.onboarding.v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

export function isOnboardingCompleted(): boolean {
  if (!canUseStorage()) {
    return false;
  }

  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === "completed";
  } catch {
    return false;
  }
}

export function setOnboardingCompleted(): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(ONBOARDING_KEY, "completed");
  } catch {
    // The app still works if localStorage is blocked.
  }
}