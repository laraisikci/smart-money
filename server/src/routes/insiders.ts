import { Router } from 'express';
import { TICKERS } from '../data/tickers.js';
import { resolveCik } from '../lib/cikResolver.js';
import { fetchInsiderTradesForTicker } from '../lib/insiderFetch.js';
import type { InsiderTrade } from '../types.js';

const RESPONSE_CACHE_TTL_MS = 6 * 60 * 60_000; // 6h — the universe is now large enough (250+
// tickers) that recomputing on every cache miss is expensive; longer caching plus the request
// coalescing below (see inFlight) are what actually protect against SEC rate limiting, more so
// than the batching itself, since the shared secClient throttle already serializes dispatch
// regardless of caller concurrency — the real risk was multiple *concurrent* cold-cache requests
// each independently kicking off a full scan.
const TICKER_BATCH_SIZE = 20;

interface ResponseCacheEntry {
  expires: number;
  value: { data: InsiderTrade[]; generatedAt: string; coverage: { resolved: string[]; unresolved: string[] } };
}
let responseCache: ResponseCacheEntry | null = null;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function computeInsiders(): Promise<ResponseCacheEntry['value']> {
  const resolved: string[] = [];
  const unresolved: string[] = [];
  const results: InsiderTrade[][] = [];

  // Process in batches of 20 tickers rather than one Promise.all across the whole (250+ ticker)
  // universe — bounds how many filings/XML fetches are in flight at once, and keeps a single
  // slow or hanging ticker from holding up the whole batch's worth of concurrent work.
  for (const batch of chunk(TICKERS, TICKER_BATCH_SIZE)) {
    const batchResults = await Promise.all(
      batch.map(async (meta) => {
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
    results.push(...batchResults);
  }

  const data = results
    .flat()
    .sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());

  return { data, generatedAt: new Date().toISOString(), coverage: { resolved, unresolved } };
}

// If a request arrives while a computation is already running (e.g. right after the 6h cache
// expires, or during initial warmup), it awaits this same in-flight promise instead of kicking
// off a second full scan of the ticker universe. Without this, N concurrent cold-cache requests
// multiply the SEC request volume by N through the exact same shared throttle — this is what
// actually caused SEC EDGAR to start timing out on us during testing, not insufficient batching.
let inFlight: Promise<ResponseCacheEntry['value']> | null = null;

export function insidersRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      if (responseCache && responseCache.expires > Date.now()) {
        return res.json(responseCache.value);
      }

      if (!inFlight) {
        inFlight = computeInsiders().finally(() => {
          inFlight = null;
        });
      }
      const value = await inFlight;

      responseCache = { expires: Date.now() + RESPONSE_CACHE_TTL_MS, value };
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch SEC EDGAR Form 4 data', detail: String(err) });
    }
  });

  return router;
}
