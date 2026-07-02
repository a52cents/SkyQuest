const POPUNDER_LANDING_URL =
  "https://www.effectivecpmnetwork.com/fu31afbd?key=d3c79b3e31b72dcc194c75aa618621ae";
const POPUNDER_STORAGE_KEY = "skyquest:last-popunder-ad-at";
const POPUNDER_INTERVAL_MS = 10 * 60 * 1000;

let lastTriggerFallback = 0;

function readLastTrigger(): number {
  try {
    const storedValue = window.localStorage.getItem(POPUNDER_STORAGE_KEY);
    const parsedValue = storedValue ? Number.parseInt(storedValue, 10) : 0;

    return Number.isFinite(parsedValue) ? parsedValue : 0;
  } catch {
    return lastTriggerFallback;
  }
}

function saveLastTrigger(timestamp: number) {
  lastTriggerFallback = timestamp;

  try {
    window.localStorage.setItem(POPUNDER_STORAGE_KEY, timestamp.toString());
  } catch {
    // In private browsing or blocked storage, the in-memory fallback still limits repeats in the current tab.
  }
}

export function isPopunderAdOnCooldown(now = Date.now()): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const lastTrigger = Math.max(readLastTrigger(), lastTriggerFallback);
  return now - lastTrigger < POPUNDER_INTERVAL_MS;
}

export function triggerPopunderAd(): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }

  if (isPopunderAdOnCooldown()) {
    return Promise.resolve(false);
  }

  const adWindow = window.open(POPUNDER_LANDING_URL, "_blank", "noopener,noreferrer");
  if (!adWindow) {
    return Promise.resolve(false);
  }

  adWindow.focus();
  saveLastTrigger(Date.now());

  return Promise.resolve(true);
}
