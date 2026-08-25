import { fetchWithTimeout } from './fetchTimeout.js';

interface CacheEntry {
  expires: number;
  value: unknown;
}
const cache = new Map<string, CacheEntry>();

export async function cachedFetchJson<T>(url: string, cacheTtlMs = 15 * 60_000): Promise<T> {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.value as T;
  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText} — ${url}`);
  }
  const value = (await res.json()) as T;
  cache.set(url, { expires: Date.now() + cacheTtlMs, value });
  return value;
}
