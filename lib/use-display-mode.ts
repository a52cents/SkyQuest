"use client";

import { useEffect, useState } from "react";

export type DisplayMode = "browser" | "standalone";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const INSTALLED_DISPLAY_MODE_QUERIES = [
  "(display-mode: standalone)",
  "(display-mode: fullscreen)",
  "(display-mode: minimal-ui)",
  "(display-mode: window-controls-overlay)",
];

export function useDisplayMode(): DisplayMode {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("browser");

  useEffect(() => {
    const mediaQueries = INSTALLED_DISPLAY_MODE_QUERIES.map((query) => window.matchMedia(query));

    const detectDisplayMode = () => {
      const isLegacyIosStandalone =
        (window.navigator as NavigatorWithStandalone).standalone === true;
      const isInstalledDisplayMode = mediaQueries.some((mediaQuery) => mediaQuery.matches);
      setDisplayMode(isInstalledDisplayMode || isLegacyIosStandalone ? "standalone" : "browser");
    };

    detectDisplayMode();
    mediaQueries.forEach((mediaQuery) => mediaQuery.addEventListener("change", detectDisplayMode));

    return () =>
      mediaQueries.forEach((mediaQuery) =>
        mediaQuery.removeEventListener("change", detectDisplayMode),
      );
  }, []);

  return displayMode;
}
