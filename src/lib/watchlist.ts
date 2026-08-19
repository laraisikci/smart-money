import type { WatchlistEntry, AnalyzeTarget } from '@/types';

// This app has no database or backend persistence — everything server-side is stateless
// fetch+cache. localStorage is the honest choice for "permanently save this stock": it survives
// reloads and browser restarts on this device, which is what "permanent" can actually mean here
// without adding real backend infrastructure nobody asked for.
const STORAGE_KEY = 'smart-money.watchlist';

function readRaw(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: WatchlistEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable (private browsing, quota) — watchlist just won't persist this session
  }
}

export function getWatchlist(): WatchlistEntry[] {
  return readRaw();
}

export function isWatchlisted(symbol: string): boolean {
  return readRaw().some((e) => e.symbol === symbol);
}

export function addToWatchlist(result: AnalyzeTarget): WatchlistEntry[] {
  const entries = readRaw();
  if (entries.some((e) => e.symbol === result.symbol)) return entries;
  const next = [
    ...entries,
    {
      symbol: result.symbol,
      name: result.name,
      market: result.market,
      currency: result.currency,
      sector: result.sector,
      addedAt: new Date().toISOString(),
    },
  ];
  writeRaw(next);
  return next;
}

export function removeFromWatchlist(symbol: string): WatchlistEntry[] {
  const next = readRaw().filter((e) => e.symbol !== symbol);
  writeRaw(next);
  return next;
}
