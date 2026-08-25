// Shared 4s timeout for every external call this app makes (SEC EDGAR, Yahoo Finance, ECB,
// Frankfurter, Polymarket, GNews). Without this, a single hung external request can stall an
// entire endpoint indefinitely — Promise.allSettled only resolves once every promise settles, so
// one fetch with no timeout at all defeats it just as badly as no allSettled in the first place.
export const DEFAULT_TIMEOUT_MS = 4_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
