export const DEFAULT_TRUSTED_WEB_PUSH_ENDPOINT_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "webpush.push.apple.com",
  "*.notify.windows.com",
] as const;

function getTrustedWebPushEndpointHostPatterns(): string[] {
  const configuredHosts = process.env.PUSH_ENDPOINT_ALLOWED_HOSTS?.split(",") ?? [];
  const normalizedConfiguredHosts = configuredHosts
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0 && host.length <= 255 && !host.includes("/"));

  return [...new Set([...DEFAULT_TRUSTED_WEB_PUSH_ENDPOINT_HOSTS, ...normalizedConfiguredHosts])];
}

function isIpAddressOrLocalhost(hostname: string): boolean {
  const normalized = hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.includes(":") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)
  );
}

function hostMatchesPattern(hostname: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1);
    return hostname.endsWith(suffix) && hostname.length > suffix.length;
  }

  return hostname === pattern;
}

export function isTrustedWebPushEndpoint(
  value: string,
  allowedHostPatterns: readonly string[] = getTrustedWebPushEndpointHostPatterns(),
): boolean {
  if (value.trim() !== value) return false;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const hasPushResource = url.pathname.length > 1 || url.search.length > 1;

    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.hash === "" &&
      hasPushResource &&
      !isIpAddressOrLocalhost(hostname) &&
      allowedHostPatterns.some((pattern) => hostMatchesPattern(hostname, pattern))
    );
  } catch {
    return false;
  }
}
