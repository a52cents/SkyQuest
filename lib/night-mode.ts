const NIGHT_MODE_KEY = "skyquest.night-mode.v1";
const DAY_THEME_COLOR = "#070911";
const NIGHT_THEME_COLOR = "#1a0000";

function canUseDom(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function setThemeColorMeta(enabled: boolean): void {
  if (!canUseDom()) {
    return;
  }

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = enabled ? NIGHT_THEME_COLOR : DAY_THEME_COLOR;
  }
}

function applyNightMode(enabled: boolean): void {
  if (!canUseDom()) {
    return;
  }

  document.documentElement.classList.toggle("night-mode", enabled);
  setThemeColorMeta(enabled);
}

export function isNightMode(): boolean {
  if (!canUseDom()) {
    return false;
  }

  try {
    const stored = window.localStorage.getItem(NIGHT_MODE_KEY);
    if (stored === "1") {
      return true;
    }
    if (stored === "0") {
      return false;
    }
  } catch {
    // Private mode can block localStorage; fall back to the DOM state.
  }

  return document.documentElement.classList.contains("night-mode");
}

export function setNightMode(enabled: boolean): void {
  if (!canUseDom()) {
    return;
  }

  applyNightMode(enabled);

  try {
    if (enabled) {
      window.localStorage.setItem(NIGHT_MODE_KEY, "1");
    } else {
      window.localStorage.removeItem(NIGHT_MODE_KEY);
    }
  } catch {
    // Storage persistence may fail in private contexts; keep the visual state.
  }
}

export function toggleNightMode(): boolean {
  const nextEnabled = !isNightMode();
  setNightMode(nextEnabled);
  return nextEnabled;
}

export function applyNightModeFromStorage(): void {
  if (!canUseDom()) {
    return;
  }

  let enabled = false;

  try {
    enabled = window.localStorage.getItem(NIGHT_MODE_KEY) === "1";
  } catch {
    enabled = document.documentElement.classList.contains("night-mode");
  }

  applyNightMode(enabled);
}