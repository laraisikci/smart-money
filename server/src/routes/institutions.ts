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

interface ResponseCacheEntry {
  expires: number;
  value: { data: InstitutionalPosition[]; generatedAt: string; failedFunds: string[] };
}
let responseCache: ResponseCacheEntry | null = null;

export function institutionsRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      if (responseCache && responseCache.expires > Date.now()) {
        return res.json(responseCache.value);
      }

      const failedFunds: string[] = [];
      const perFund = await Promise.all(
        FUNDS.map(async (fund) => {
          try {
            return await fetchFundPositions(fund);
          } catch {
            failedFunds.push(fund.name);
            return [] as InstitutionalPosition[];
          }
        }),
      );

      const data = perFund
        .flat()
        .sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());

      const value = { data, generatedAt: new Date().toISOString(), failedFunds };
      responseCache = { expires: Date.now() + 30 * 60_000, value };
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch SEC EDGAR 13F data', detail: String(err) });
    }
  });

  return router;
}
