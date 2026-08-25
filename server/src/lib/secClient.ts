const SEC_USER_AGENT = process.env.SEC_USER_AGENT;

if (!SEC_USER_AGENT) {
  throw new Error(
    'SEC_USER_AGENT env var is required — SEC EDGAR blocks requests without an identifying ' +
      'User-Agent (format: "AppName contact@email.com"). Set it in server/.env.',
  );
}

// SEC's fair-access policy caps requests at 10/sec across all of EDGAR. We stay well under
// that with a simple queue so concurrent route handlers never burst past it.
const MIN_INTERVAL_MS = 150;
let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();

function throttle(): Promise<void> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  queue = run;
  return run;
}

const REQUEST_TIMEOUT_MS = 4_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Exponential backoff (500ms, 1500ms, ...) with jitter, capped, so retries spread out instead
// of all hammering SEC at the same instant after an outage.
function backoffMs(attempt: number): number {
  const base = 500 * 3 ** (attempt - 1);
  const jitter = Math.random() * 250;
  return Math.min(base, 8000) + jitter;
}

interface CacheEntry {
  expires: number;
  value: unknown;
}
const cache = new Map<string, CacheEntry>();

async function secFetch(url: string): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await throttle();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': SEC_USER_AGENT!,
          Accept: 'application/json, text/xml, application/xml, */*',
        },
      });

      if (res.ok) return res;

      if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
        // Honor Retry-After when SEC sends one (typically on 429s); otherwise fall back to our
        // own backoff schedule.
        const retryAfter = res.headers.get('retry-after');
        const waitMs = retryAfter ? Number(retryAfter) * 1000 : backoffMs(attempt);
        await sleep(Number.isFinite(waitMs) ? waitMs : backoffMs(attempt));
        continue;
      }

      throw new Error(`SEC EDGAR request failed: ${res.status} ${res.statusText} — ${url}`);
    } catch (err) {
      lastErr = err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isNetworkError = err instanceof TypeError; // fetch throws TypeError on network failure
      if ((isAbort || isNetworkError) && attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
      if (isAbort) throw new Error(`SEC EDGAR request timed out after ${REQUEST_TIMEOUT_MS}ms — ${url}`);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Unreachable in practice (every branch above either returns or throws), but keeps TS happy
  // and fails loudly rather than silently if the loop logic above ever changes.
  throw lastErr instanceof Error ? lastErr : new Error(`SEC EDGAR request failed — ${url}`);
}

export async function secFetchJson<T>(url: string, cacheTtlMs = 15 * 60_000): Promise<T> {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.value as T;
  const res = await secFetch(url);
  const value = (await res.json()) as T;
  cache.set(url, { expires: Date.now() + cacheTtlMs, value });
  return value;
}

export async function secFetchText(url: string, cacheTtlMs = 15 * 60_000): Promise<string> {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.value as string;
  const res = await secFetch(url);
  const value = await res.text();
  cache.set(url, { expires: Date.now() + cacheTtlMs, value });
  return value;
}

export function cikToPadded(cik: number | string): string {
  return String(cik).padStart(10, '0');
}
