export const NETWORK_TIMEOUT_MS = 60_000;

export function createNetworkTimeoutSignal(timeoutMs = NETWORK_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}
