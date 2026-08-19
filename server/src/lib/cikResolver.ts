import { secFetchJson, cikToPadded } from './secClient.js';
import { EU_TO_SEC_TICKER } from '../data/euAdrMap.js';
import { normalize } from './nameMatch.js';
import type { TickerMeta } from '../data/tickers.js';

interface CompanyTickersEntry {
  cik_str: number;
  ticker: string;
  title: string;
}
type CompanyTickersResponse = Record<string, CompanyTickersEntry>;

let tickerIndex: Map<string, CompanyTickersEntry> | null = null;

async function loadTickerIndex(): Promise<Map<string, CompanyTickersEntry>> {
  if (tickerIndex) return tickerIndex;
  const data = await secFetchJson<CompanyTickersResponse>(
    'https://www.sec.gov/files/company_tickers.json',
    24 * 60 * 60_000, // this file changes rarely; a 24h cache is plenty
  );
  const map = new Map<string, CompanyTickersEntry>();
  for (const entry of Object.values(data)) {
    map.set(entry.ticker.toUpperCase(), entry);
  }
  tickerIndex = map;
  return map;
}

export interface ResolvedCik {
  cik: string;
  cikPadded: string;
  secTicker: string;
  title: string;
}

/**
 * Resolves one of our app's tickers to a real SEC CIK. US tickers are matched directly against
 * SEC's own ticker list. EU tickers only resolve if they're in the curated EU_TO_SEC_TICKER map
 * (see data/euAdrMap.ts) — most EU issuers simply have no SEC filer to resolve to.
 */
export async function resolveCik(meta: TickerMeta): Promise<ResolvedCik | null> {
  const index = await loadTickerIndex();
  const secTicker = meta.market === 'US' ? meta.symbol : EU_TO_SEC_TICKER[meta.symbol];
  if (!secTicker) return null;
  const entry = index.get(secTicker.toUpperCase());
  if (!entry) return null;
  return {
    cik: String(entry.cik_str),
    cikPadded: cikToPadded(entry.cik_str),
    secTicker,
    title: entry.title,
  };
}

function toResolvedCik(entry: CompanyTickersEntry): ResolvedCik {
  return {
    cik: String(entry.cik_str),
    cikPadded: cikToPadded(entry.cik_str),
    secTicker: entry.ticker,
    title: entry.title,
  };
}

/**
 * Same idea as resolveCik, but for an arbitrary user search query rather than one of our own
 * tracked tickers — used by the ad-hoc "search any stock" feature. Tries the query as a bare
 * ticker first (stripping any exchange suffix like ".AS"/".MC" — SEC's own ticker list has no
 * such suffixes even for dual-listed names), then falls back to an exact company-name match
 * against SEC's full ~10k-entry list. Most EU-only issuers (no US listing at all) genuinely have
 * no SEC filer to resolve to — that's a real fact about the company, not a resolution failure, so
 * this returning null is expected and honest for those, not a bug.
 */
export async function resolveCikByQuery(query: string): Promise<ResolvedCik | null> {
  const index = await loadTickerIndex();

  const bareTicker = query.split('.')[0].toUpperCase();
  const direct = index.get(bareTicker);
  if (direct) return toResolvedCik(direct);

  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;
  for (const entry of index.values()) {
    if (normalize(entry.title) === normalizedQuery) return toResolvedCik(entry);
  }
  return null;
}
