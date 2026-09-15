import { Router } from 'express';
import { fetchWithTimeout } from '../lib/fetchTimeout.js';
import { getCoreTechnicals } from '../lib/technicalsFetch.js';
import { TICKERS } from '../data/tickers.js';
import type { OptionActivity } from '../types.js';

// CBOE's free, keyless delayed-quotes endpoint — the same one their own public quote-lookup page
// calls client-side, verified directly to need no auth (unlike Yahoo's options chain, which
// requires the same crumb/cookie flow Render's IP is blocked from — see finnhubClient.ts's
// history for that saga). US-listed only, which is fine: every stock this endpoint can answer
// for is exactly the ones safe to query by our internal ticker symbol in the first place.
const CBOE_TIMEOUT_MS = 10_000; // a full chain response runs ~1-1.5MB; the shared 4s default is too tight
const CACHE_TTL_MS = 30 * 60_000; // 30min, per spec

// Deliberately small and deliberately US-only:
// 1. Resource cost — each ticker's full chain is a ~1-1.5MB JSON parse; scanning the whole
//    ~250-ticker universe here would be a heavier version of exactly the cold-start resource
//    problem this app already fought and fixed once this session (see prewarm.ts's history).
// 2. Correctness — our internal EU ticker codes are short, market-local codes (e.g. "DTE" is
//    Deutsche Telekom here, but the real US ticker DTE is DTE Energy Co, a different company
//    entirely). Querying CBOE with those would silently return the wrong company's data. Every
//    US-market tracked ticker's internal symbol IS its real US exchange symbol, so this is only
//    ever safe for market === 'US'. EU tickers get clearly-labeled sample data client-side
//    instead (see src/data/sampleOptionsFlow.ts) — an honest substitute, not a workaround.
const SCAN_TICKER_COUNT = 25;
const FETCH_BATCH_SIZE = 5;

// Filtered before ranking, not just for size — a contract 300 days out or 80% out of the money
// isn't what "unusual activity worth showing someone" means.
const MAX_DAYS_TO_EXPIRY = 90;
const MAX_MONEYNESS_PCT = 40; // |strike - price| / price, as a percent
const MIN_VOLUME = 50; // filters out illiquid noise where a 3-contract trade looks like a 300% spike
const UNUSUAL_RATIO_THRESHOLD = 2; // volume > 2x open interest — today's flow meaningfully exceeds existing positioning
const TOP_PER_TICKER = 4;

interface CboeOption {
  option: string; // OCC symbol, e.g. AAPL260914C00245000
  volume?: number;
  open_interest?: number;
  last_trade_price?: number;
  iv?: number;
}
interface CboeResponse {
  data?: { options?: CboeOption[] };
}

// OCC symbols are fixed-width from the right: 6-digit date (YYMMDD) + C/P + 8-digit strike
// (thousandths of a dollar). Everything before that is the root symbol — variable length, so
// parsed from the end rather than assumed to be a fixed prefix length.
function parseOccSymbol(occ: string): { date: string; type: 'CALL' | 'PUT'; strike: number } | null {
  if (occ.length < 15) return null;
  const tail = occ.slice(-15);
  const dateStr = tail.slice(0, 6);
  const cp = tail.slice(6, 7);
  const strikeStr = tail.slice(7);
  if (!/^\d{6}$/.test(dateStr) || (cp !== 'C' && cp !== 'P') || !/^\d{8}$/.test(strikeStr)) return null;
  const year = 2000 + Number(dateStr.slice(0, 2));
  const month = dateStr.slice(2, 4);
  const day = dateStr.slice(4, 6);
  return {
    date: `${year}-${month}-${day}`,
    type: cp === 'C' ? 'CALL' : 'PUT',
    strike: Number(strikeStr) / 1000,
  };
}

async function fetchChainForTicker(symbol: string, companyName: string): Promise<OptionActivity[]> {
  const core = await getCoreTechnicals(symbol).catch(() => null);
  if (!core) return [];

  const res = await fetchWithTimeout(
    `https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(symbol)}.json`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (SmartMoneyDashboard)', Accept: 'application/json' } },
    CBOE_TIMEOUT_MS,
  );
  if (!res.ok) return [];
  const body = (await res.json()) as CboeResponse;
  const options = body.data?.options ?? [];

  const now = Date.now();
  const candidates: (OptionActivity & { ratio: number })[] = [];

  for (const opt of options) {
    const parsed = parseOccSymbol(opt.option);
    if (!parsed) continue;

    const volume = opt.volume ?? 0;
    const openInterest = opt.open_interest ?? 0;
    if (volume < MIN_VOLUME) continue;

    const daysToExpiry = Math.round((new Date(parsed.date).getTime() - now) / 86_400_000);
    if (daysToExpiry < 0 || daysToExpiry > MAX_DAYS_TO_EXPIRY) continue;

    const moneynessPct = (Math.abs(parsed.strike - core.price) / core.price) * 100;
    if (moneynessPct > MAX_MONEYNESS_PCT) continue;

    const ratio = volume / Math.max(openInterest, 1);
    if (ratio < UNUSUAL_RATIO_THRESHOLD) continue;

    candidates.push({
      ticker: symbol,
      companyName,
      type: parsed.type,
      strike: parsed.strike,
      expiry: parsed.date,
      volume,
      openInterest,
      lastPrice: opt.last_trade_price ?? 0,
      iv: opt.iv ?? null,
      currentPrice: core.price,
      ratio,
    });
  }

  return candidates
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, TOP_PER_TICKER)
    .map((c): OptionActivity => ({
      ticker: c.ticker,
      companyName: c.companyName,
      type: c.type,
      strike: c.strike,
      expiry: c.expiry,
      volume: c.volume,
      openInterest: c.openInterest,
      lastPrice: c.lastPrice,
      iv: c.iv,
      currentPrice: c.currentPrice,
    }));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface ResponseCacheEntry {
  expires: number;
  value: { data: OptionActivity[]; generatedAt: string; scannedTickers: string[] };
}
let responseCache: ResponseCacheEntry | null = null;
let inFlight: Promise<ResponseCacheEntry['value']> | null = null;

async function computeOptionsFlow(): Promise<ResponseCacheEntry['value']> {
  const usTickers = TICKERS.filter((t) => t.market === 'US').slice(0, SCAN_TICKER_COUNT);
  const results: OptionActivity[] = [];
  const scannedTickers: string[] = [];

  for (const batch of chunk(usTickers, FETCH_BATCH_SIZE)) {
    const settled = await Promise.allSettled(batch.map((meta) => fetchChainForTicker(meta.symbol, meta.name)));
    settled.forEach((r, i) => {
      scannedTickers.push(batch[i].symbol);
      if (r.status === 'fulfilled') results.push(...r.value);
    });
  }

  return { data: results, generatedAt: new Date().toISOString(), scannedTickers };
}

export async function getCachedOptionsFlow(): Promise<ResponseCacheEntry['value']> {
  if (responseCache && responseCache.expires > Date.now()) {
    return responseCache.value;
  }
  if (!inFlight) {
    inFlight = computeOptionsFlow().finally(() => {
      inFlight = null;
    });
  }
  const value = await inFlight;
  responseCache = { expires: Date.now() + CACHE_TTL_MS, value };
  return value;
}

export function optionsFlowRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const value = await getCachedOptionsFlow();
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch options flow', detail: String(err) });
    }
  });

  return router;
}
