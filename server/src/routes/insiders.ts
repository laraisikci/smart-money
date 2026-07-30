import { Router } from 'express';
import { TICKERS } from '../data/tickers.js';
import { resolveCik } from '../lib/cikResolver.js';
import { listFilings, primaryDocBasename, fetchFilingDocXml } from '../lib/edgarFilings.js';
import { xmlParser, toArray, num } from '../lib/xml.js';
import type { InsiderTrade } from '../types.js';

const FILINGS_PER_TICKER = 5;
const TRANSACTIONS_PER_FILING = 6;

interface ResponseCacheEntry {
  expires: number;
  value: { data: InsiderTrade[]; generatedAt: string; coverage: { resolved: string[]; unresolved: string[] } };
}
let responseCache: ResponseCacheEntry | null = null;

function insiderTitleFrom(rel: {
  isOfficer?: boolean | string;
  officerTitle?: string;
  isDirector?: boolean | string;
  isTenPercentOwner?: boolean | string;
}): string {
  const truthy = (v: unknown) => v === true || v === 'true' || v === '1';
  if (truthy(rel.isOfficer) && rel.officerTitle) return rel.officerTitle;
  if (truthy(rel.isDirector)) return 'Director';
  if (truthy(rel.isTenPercentOwner)) return '10% Owner';
  return 'Insider';
}

async function fetchInsiderTradesForTicker(
  ticker: string,
  market: 'EU' | 'US',
  cik: string,
): Promise<InsiderTrade[]> {
  const filings = await listFilings(cik, '4', FILINGS_PER_TICKER);
  const trades: InsiderTrade[] = [];

  for (const filing of filings) {
    try {
      const filename = primaryDocBasename(filing.primaryDocument);
      const xml = await fetchFilingDocXml(cik, filing.accessionNoDash, filename);
      const doc = xmlParser.parse(xml)?.ownershipDocument;
      if (!doc) continue;

      const owner = doc.reportingOwner?.reportingOwnerId?.rptOwnerName ?? 'Unknown';
      const title = insiderTitleFrom(doc.reportingOwner?.reportingOwnerRelationship ?? {});

      const nonDerivative = toArray(doc.nonDerivativeTable?.nonDerivativeTransaction);
      let seq = 0;
      for (const txn of nonDerivative) {
        if (seq >= TRANSACTIONS_PER_FILING) break;
        const code = txn?.transactionCoding?.transactionCode;
        if (code !== 'P' && code !== 'S') continue; // only genuine open-market buys/sells

        const shares = num(txn?.transactionAmounts?.transactionShares?.value);
        const price = num(txn?.transactionAmounts?.transactionPricePerShare?.value);
        const txnDate = txn?.transactionDate?.value ?? filing.reportDate;
        if (!shares || !price) continue;

        trades.push({
          id: `${filing.accessionNumber}-${seq}`,
          ticker,
          insiderName: owner,
          insiderTitle: title,
          transactionType: code === 'P' ? 'BUY' : 'SELL',
          shares,
          price,
          value: Math.round(shares * price),
          filingDate: txnDate,
          market,
        });
        seq++;
      }
    } catch {
      // one bad filing shouldn't take down the whole ticker
      continue;
    }
  }

  return trades;
}

export function insidersRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      if (responseCache && responseCache.expires > Date.now()) {
        return res.json(responseCache.value);
      }

      const resolved: string[] = [];
      const unresolved: string[] = [];
      const perTicker = await Promise.all(
        TICKERS.map(async (meta) => {
          const cikInfo = await resolveCik(meta);
          if (!cikInfo) {
            unresolved.push(meta.symbol);
            return [] as InsiderTrade[];
          }
          resolved.push(meta.symbol);
          try {
            return await fetchInsiderTradesForTicker(meta.symbol, meta.market, cikInfo.cikPadded);
          } catch {
            return [] as InsiderTrade[];
          }
        }),
      );

      const data = perTicker
        .flat()
        .sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());

      const value = { data, generatedAt: new Date().toISOString(), coverage: { resolved, unresolved } };
      responseCache = { expires: Date.now() + 10 * 60_000, value };
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch SEC EDGAR Form 4 data', detail: String(err) });
    }
  });

  return router;
}
