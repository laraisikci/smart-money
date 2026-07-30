import { secFetchJson, cikToPadded } from './secClient.js';
import { EU_TO_SEC_TICKER } from '../data/euAdrMap.js';
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
