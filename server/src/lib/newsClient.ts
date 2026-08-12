// Shared client for everything hitting Yahoo Finance (RSS headlines + symbol search) — GNews and
// NewsAPI (the two other sources originally considered) both require an API key nobody has
// provided here, and NewsAPI's free tier explicitly CORS-blocks any non-localhost origin, so it
// would never work from this deployed backend even with a key. Yahoo's endpoints are free,
// keyless, and verified working directly.
//
// Undocumented rate limits, so this errs conservative and — since both the RSS feed and the
// symbol-search endpoint below are the same provider — shares one throttle queue across both
// rather than letting two independently-throttled call sites collectively hammer Yahoo faster
// than either intends.
const MIN_INTERVAL_MS = 200;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(500 * 2 ** (attempt - 1), 4000) + Math.random() * 250;
}

async function yahooFetch(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await throttle();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (SmartMoneyDashboard)', Accept: 'application/rss+xml, application/json, text/xml, */*' },
      });
      if (res.ok) return res;
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new Error(`Yahoo request failed: ${res.status} ${res.statusText} — ${url}`);
    } catch (err) {
      lastErr = err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isNetworkError = err instanceof TypeError;
      if ((isAbort || isNetworkError) && attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw isAbort ? new Error(`Yahoo request timed out — ${url}`) : err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Yahoo request failed — ${url}`);
}

interface CacheEntry<T> {
  expires: number;
  value: T;
}
const textCache = new Map<string, CacheEntry<string>>();

export async function fetchNewsRss(url: string, cacheTtlMs: number): Promise<string> {
  const cached = textCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.value;
  const res = await yahooFetch(url);
  const text = await res.text();
  textCache.set(url, { expires: Date.now() + cacheTtlMs, value: text });
  return text;
}

const jsonCache = new Map<string, CacheEntry<unknown>>();

export async function fetchYahooJson<T>(url: string, cacheTtlMs: number): Promise<T> {
  const cached = jsonCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.value as T;
  const res = await yahooFetch(url);
  const value = (await res.json()) as T;
  jsonCache.set(url, { expires: Date.now() + cacheTtlMs, value });
  return value;
}
