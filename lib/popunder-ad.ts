const POPUNDER_SCRIPT_SRC = "https://pl30132581.effectivecpmnetwork.com/fa/d4/c9/fad4c94d2017ce5a73518ced0d75a611.js";
const POPUNDER_STORAGE_KEY = "skyquest:last-popunder-ad-at";
const POPUNDER_INTERVAL_MS = 10 * 60 * 1000;
const POPUNDER_LOAD_TIMEOUT_MS = 10 * 1000;

let lastTriggerFallback = 0;
let pendingTrigger: Promise<boolean> | null = null;

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

  if (pendingTrigger) {
    return pendingTrigger;
  }

  pendingTrigger = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    let isSettled = false;

    function finish(didLoad: boolean) {
      if (isSettled) {
        return;
      }

      isSettled = true;
      window.clearTimeout(timeoutId);
      script.remove();

      // The cooldown starts only after the advertising script has loaded and run.
      if (didLoad) {
        saveLastTrigger(Date.now());
      }

      pendingTrigger = null;
      resolve(didLoad);
    }

    const timeoutId = window.setTimeout(() => finish(false), POPUNDER_LOAD_TIMEOUT_MS);
    script.src = POPUNDER_SCRIPT_SRC;
    script.async = true;
    script.dataset.skyquestPopunder = "true";
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });

  return pendingTrigger;
}
