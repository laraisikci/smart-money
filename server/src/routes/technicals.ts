import { Router } from 'express';
import { TICKERS } from '../data/tickers.js';
import { resolveTickerYahooSymbol } from '../lib/yahooSymbolResolver.js';
import { getTechnicals, getCoreTechnicals } from '../lib/technicalsFetch.js';
import type { TechnicalIndicators } from '../types.js';

const CACHE_TTL_MS = 4 * 60 * 60_000; // matches the per-ticker technicals cache — no point being fresher
const TICKER_BATCH_SIZE = 15;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface ResponseCacheEntry {
  expires: number;
  value: { data: Record<string, TechnicalIndicators>; generatedAt: string };
}
let responseCache: ResponseCacheEntry | null = null;
let inFlight: Promise<ResponseCacheEntry['value']> | null = null;

// Deliberately skips analyst data (getCoreTechnicals, not getTechnicals) — this exists purely to
// let the Conviction tab apply its technical-breakdown cap and "Confirmed only" filter across the
// whole tracked universe without firing ~250 Finnhub requests (60/min free-tier limit) for data
// that cap doesn't use. `analyst` is always null in this response; use /api/technicals/:ticker
// for the real thing. Same batched-scan shape as /api/insiders and /api/news, for the same
// reason (bound concurrent Yahoo chart fetches rather than one Promise.all across 250+ tickers).
async function computeAllCoreTechnicals(): Promise<ResponseCacheEntry['value']> {
  const data: Record<string, TechnicalIndicators> = {};

  for (const batch of chunk(TICKERS, TICKER_BATCH_SIZE)) {
    await Promise.all(
      batch.map(async (meta) => {
        try {
          const yahooSymbol = await resolveTickerYahooSymbol(meta);
          if (!yahooSymbol) return;
          const core = await getCoreTechnicals(yahooSymbol);
          data[meta.symbol] = { ticker: meta.symbol, ...core, analyst: null };
        } catch {
          // skip — same "a ticker with no data just doesn't appear" honesty as every other bulk route
        }
      }),
    );
  }

  return { data, generatedAt: new Date().toISOString() };
}

// Shared by the route handler and (potentially) startup pre-warm, same pattern as every other
// bulk endpoint's getCached*().
export async function getCachedAllCoreTechnicals(): Promise<ResponseCacheEntry['value']> {
  if (responseCache && responseCache.expires > Date.now()) {
    return responseCache.value;
  }
  if (!inFlight) {
    inFlight = computeAllCoreTechnicals().finally(() => {
      inFlight = null;
    });
  }
  const value = await inFlight;
  responseCache = { expires: Date.now() + CACHE_TTL_MS, value };
  return value;
}

export function technicalsRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const value = await getCachedAllCoreTechnicals();
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to compute bulk technical indicators', detail: String(err) });
    }
  });

  router.get('/:ticker', async (req, res) => {
    const symbol = req.params.ticker.toUpperCase();
    const meta = TICKERS.find((t) => t.symbol === symbol);
    if (!meta) {
      return res.status(404).json({ error: `Unknown ticker: ${symbol}` });
    }

    try {
      const yahooSymbol = await resolveTickerYahooSymbol(meta);
      if (!yahooSymbol) {
        return res.status(502).json({ error: `Could not resolve a Yahoo symbol for ${symbol}` });
      }
      const value = await getTechnicals(symbol, yahooSymbol);
      res.json({ data: value });
    } catch (err) {
      res.status(502).json({ error: 'Failed to compute technical indicators', detail: String(err) });
    }
  });

  return router;
}
