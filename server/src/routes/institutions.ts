import { Router } from 'express';
import { TICKERS } from '../data/tickers.js';
import { FUNDS } from '../data/funds.js';
import { buildIssuerMatcher } from '../lib/nameMatch.js';
import { fetchFundPositionsForMatcher } from '../lib/institutionFetch.js';
import type { InstitutionalPosition } from '../types.js';

// Built once per module load (not per row/filing) — some filers report thousands of holding
// rows, and re-normalizing all ~250 tracked tickers on every single row would be wasteful.
const issuerMatcher = buildIssuerMatcher(TICKERS);

async function fetchFundPositions(fund: (typeof FUNDS)[number]): Promise<InstitutionalPosition[]> {
  return fetchFundPositionsForMatcher(fund, issuerMatcher);
}

const RESPONSE_CACHE_TTL_MS = 6 * 60 * 60_000; // 6h, per spec — 13F filings only update quarterly anyway

interface ResponseCacheValue {
  data: InstitutionalPosition[];
  generatedAt: string;
  failedFunds: string[];
}
interface ResponseCacheEntry {
  expires: number;
  value: ResponseCacheValue;
}
let responseCache: ResponseCacheEntry | null = null;

export async function computeInstitutions(): Promise<ResponseCacheValue> {
  const settled = await Promise.allSettled(FUNDS.map((fund) => fetchFundPositions(fund)));

  const failedFunds: string[] = [];
  const perFund: InstitutionalPosition[][] = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      perFund.push(result.value);
    } else {
      failedFunds.push(FUNDS[i].name);
    }
  });

  const data = perFund
    .flat()
    .sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());

  return { data, generatedAt: new Date().toISOString(), failedFunds };
}

// Same request-coalescing as /api/insiders and /api/news — a second request arriving mid-
// computation awaits the same in-flight promise instead of independently kicking off a second
// 10-fund scan.
let inFlight: Promise<ResponseCacheValue> | null = null;

// Shared by the route handler and the startup pre-warm task (see lib/prewarm.ts).
export async function getCachedInstitutions(): Promise<ResponseCacheValue> {
  if (responseCache && responseCache.expires > Date.now()) {
    return responseCache.value;
  }
  if (!inFlight) {
    inFlight = computeInstitutions().finally(() => {
      inFlight = null;
    });
  }
  const value = await inFlight;
  responseCache = { expires: Date.now() + RESPONSE_CACHE_TTL_MS, value };
  return value;
}

export function institutionsRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const value = await getCachedInstitutions();
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch SEC EDGAR 13F data', detail: String(err) });
    }
  });

  return router;
}
