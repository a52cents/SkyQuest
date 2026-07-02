"use client";

import { useEffect } from "react";
import { registerSkyQuestServiceWorker } from "@/lib/service-worker-client";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let disposed = false;
    const register = async () => {
      try {
        const registration = await registerSkyQuestServiceWorker();
        if (!disposed) void registration.update().catch(() => undefined);
      } catch {
        // Offline support is progressive enhancement; registration must never crash the app.
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      disposed = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
