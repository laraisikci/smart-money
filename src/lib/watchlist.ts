import type { WatchlistEntry, AnalyzeTarget, WatchlistSnapshot } from '@/types';
import { TICKERS } from '@/data/tickers';

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
  syncWatchlistToUrl(entries);
}

// ---- Shareable URL ----
// localStorage is invisible to any other browser context (e.g. a scheduled briefing), so the
// current watchlist is mirrored into the page URL as `?watchlist=ASML,ITX,SAP` on every change.
// Opening that URL elsewhere imports those tickers (see hydrateWatchlistFromUrl).
const URL_PARAM = 'watchlist';

export function syncWatchlistToUrl(entries: WatchlistEntry[]): void {
  try {
    const url = new URL(window.location.href);
    if (entries.length > 0) url.searchParams.set(URL_PARAM, entries.map((e) => e.symbol).join(','));
    else url.searchParams.delete(URL_PARAM);
    window.history.replaceState(null, '', url.toString());
  } catch {
    // no window/history (SSR, sandboxed iframe) — the share link is built on demand anyway
  }
}

export function buildShareUrl(entries: WatchlistEntry[] = readRaw()): string {
  const url = new URL(window.location.origin + window.location.pathname);
  if (entries.length > 0) url.searchParams.set(URL_PARAM, entries.map((e) => e.symbol).join(','));
  return url.toString();
}

// ---- Export / import ----
export function exportWatchlistText(entries: WatchlistEntry[] = readRaw()): string {
  return entries.map((e) => e.symbol).join('\n');
}

// Accepts newline-, comma-, semicolon- or space-separated tickers. Matches a tracked symbol
// exactly first (so "SAN.MC" stays Santander), then with an exchange suffix stripped ("ITX.MC" ->
// ITX) — the form analysts and data vendors usually write.
function matchTracked(token: string): string | null {
  const upper = token.trim().toUpperCase();
  if (!upper) return null;
  const direct = TICKERS.find((t) => t.symbol.toUpperCase() === upper);
  if (direct) return direct.symbol;
  const base = upper.replace(/\.[A-Z]{1,3}$/, '');
  const stripped = TICKERS.find((t) => t.symbol.toUpperCase() === base);
  return stripped ? stripped.symbol : null;
}

export interface ImportResult {
  added: string[];
  alreadyOnList: string[];
  notFound: string[];
}

const PENDING_SNAPSHOT: WatchlistSnapshot = {
  convictionScore: 0,
  rsi: null,
  stochK: null,
  vsSma50: null,
  vsSma200: null,
  institutionalStance: 'neutral',
  newsSentiment: 'neutral',
};

export function importWatchlistText(text: string): ImportResult {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const entries = readRaw();
  const result: ImportResult = { added: [], alreadyOnList: [], notFound: [] };
  const seen = new Set<string>();
  for (const token of tokens) {
    const symbol = matchTracked(token);
    if (!symbol) {
      if (!result.notFound.includes(token)) result.notFound.push(token);
      continue;
    }
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    if (entries.some((e) => e.symbol === symbol)) {
      result.alreadyOnList.push(symbol);
      continue;
    }
    const meta = TICKERS.find((t) => t.symbol === symbol);
    if (!meta) continue;
    entries.push({
      symbol: meta.symbol,
      name: meta.name,
      market: meta.market,
      currency: meta.currency,
      sector: meta.sector,
      addedAt: new Date().toISOString(),
      snapshot: PENDING_SNAPSHOT,
      snapshotPending: true,
    });
    result.added.push(symbol);
  }
  if (result.added.length > 0) writeRaw(entries);
  return result;
}

// Opening a shared link in a browser with an empty watchlist imports the tickers in it. A
// browser that already has its own watchlist keeps it (the URL is then rewritten to match) —
// a stale link must never silently re-add stocks someone deliberately removed.
export function hydrateWatchlistFromUrl(): void {
  try {
    const param = new URL(window.location.href).searchParams.get(URL_PARAM);
    if (param && readRaw().length === 0) importWatchlistText(param);
    // Always leave the URL reflecting the watchlist actually in this browser.
    syncWatchlistToUrl(readRaw());
  } catch {
    // ignore
  }
}

// Replaces the placeholder baseline of an imported entry with a real snapshot, once.
export function setSnapshot(symbol: string, snapshot: WatchlistSnapshot): WatchlistEntry[] {
  const next = readRaw().map((e) => (e.symbol === symbol ? { ...e, snapshot, snapshotPending: false } : e));
  writeRaw(next);
  return next;
}

export function getWatchlist(): WatchlistEntry[] {
  return readRaw();
}

export function isWatchlisted(symbol: string): boolean {
  return readRaw().some((e) => e.symbol === symbol);
}

export function addToWatchlist(result: AnalyzeTarget, snapshot: WatchlistSnapshot): WatchlistEntry[] {
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
      snapshot,
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
