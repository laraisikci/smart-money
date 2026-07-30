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

interface CacheEntry {
  expires: number;
  value: unknown;
}
const cache = new Map<string, CacheEntry>();

async function secFetch(url: string): Promise<Response> {
  await throttle();
  const res = await fetch(url, {
    headers: {
      'User-Agent': SEC_USER_AGENT!,
      Accept: 'application/json, text/xml, application/xml, */*',
    },
  });
  if (!res.ok) {
    throw new Error(`SEC EDGAR request failed: ${res.status} ${res.statusText} — ${url}`);
  }
  return res;
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
