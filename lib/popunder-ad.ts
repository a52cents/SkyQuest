const POPUNDER_SCRIPT_SRC = "https://pl30132581.effectivecpmnetwork.com/fa/d4/c9/fad4c94d2017ce5a73518ced0d75a611.js";
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

export function triggerPopunderAd() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const now = Date.now();
  if (isPopunderAdOnCooldown(now)) {
    return false;
  }

  saveLastTrigger(now);

  const script = document.createElement("script");
  script.src = POPUNDER_SCRIPT_SRC;
  script.async = true;
  script.dataset.skyquestPopunder = "true";
  script.onload = () => script.remove();
  script.onerror = () => script.remove();
  document.head.appendChild(script);

  return true;
}
