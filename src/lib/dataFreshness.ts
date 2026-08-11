import { useSyncExternalStore } from 'react';

// A tiny external store tracking when each live data source last actually succeeded, so the
// header's status indicator reflects real fetch outcomes instead of being a hardcoded "Live"
// badge. useApi() reports into this automatically for any hook call that's given a source name;
// nothing here triggers its own fetches — it only reflects what tabs have already fetched.
export interface FreshnessEntry {
  source: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  loading: boolean;
}

const state = new Map<string, FreshnessEntry>();
const listeners = new Set<() => void>();
let cachedSnapshot: FreshnessEntry[] | null = null;

function invalidate() {
  cachedSnapshot = null;
  listeners.forEach((l) => l());
}

function upsert(source: string, patch: Partial<FreshnessEntry>) {
  const prev = state.get(source) ?? { source, lastSuccessAt: null, lastError: null, loading: false };
  state.set(source, { ...prev, ...patch });
  invalidate();
}

export function reportFreshnessLoading(source: string) {
  upsert(source, { loading: true });
}

export function reportFreshnessSuccess(source: string, generatedAt: string | null) {
  upsert(source, { lastSuccessAt: generatedAt ?? new Date().toISOString(), lastError: null, loading: false });
}

export function reportFreshnessError(source: string, error: string) {
  upsert(source, { lastError: error, loading: false });
}

function getSnapshot(): FreshnessEntry[] {
  if (!cachedSnapshot) cachedSnapshot = Array.from(state.values());
  return cachedSnapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFreshnessSnapshot(): FreshnessEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
