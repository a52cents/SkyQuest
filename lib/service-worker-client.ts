"use client";

type TrustedScriptUrl = object;

type TrustedTypesPolicy = {
  createScriptURL(input: string): TrustedScriptUrl;
};

type TrustedTypesFactory = {
  createPolicy(name: string, rules: { createScriptURL(input: string): string }): TrustedTypesPolicy;
};

type WindowWithTrustedTypes = Window & {
  trustedTypes?: TrustedTypesFactory;
};

let serviceWorkerPolicy: TrustedTypesPolicy | null = null;

function getServiceWorkerScriptUrl(): string {
  const trustedTypes = (window as WindowWithTrustedTypes).trustedTypes;
  if (!trustedTypes) return "/sw.js";

  serviceWorkerPolicy ??= trustedTypes.createPolicy("skyquest-sw", {
    createScriptURL(input) {
      const url = new URL(input, window.location.origin);
      if (
        url.origin !== window.location.origin ||
        url.pathname !== "/sw.js" ||
        url.search !== "" ||
        url.hash !== ""
      ) {
        throw new TypeError("Service Worker URL rejected");
      }
      return url.href;
    },
  });

  // lib.dom still types register() as string | URL, while Chromium accepts TrustedScriptURL.
  return serviceWorkerPolicy.createScriptURL("/sw.js") as unknown as string;
}

export async function registerSkyQuestServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker unavailable");
  }
  return navigator.serviceWorker.register(getServiceWorkerScriptUrl(), { scope: "/" });
}
