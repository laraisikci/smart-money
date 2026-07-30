import { Router } from 'express';
import { cachedFetchJson } from '../lib/cache.js';
import { TICKERS } from '../data/tickers.js';
import type { PolymarketMarket } from '../types.js';

// Gamma API is fully public (no key), but some fields come back as JSON-encoded strings
// rather than native arrays depending on the endpoint version — parse defensively either way.
function parseMaybeJson<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

interface GammaEvent {
  title?: string;
  tags?: { label?: string }[];
}

interface GammaMarket {
  id?: string | number;
  question?: string;
  outcomes?: unknown;
  outcomePrices?: unknown;
  volume?: string | number;
  volumeNum?: number;
  liquidity?: string | number;
  liquidityNum?: number;
  endDate?: string;
  events?: GammaEvent[];
}

function categoryOf(m: GammaMarket): string {
  const event = m.events?.[0];
  return event?.tags?.[0]?.label ?? event?.title ?? 'Markets';
}

function yesPriceOf(m: GammaMarket): number | null {
  const outcomes = parseMaybeJson<string[]>(m.outcomes, []);
  const prices = parseMaybeJson<(string | number)[]>(m.outcomePrices, []);
  if (outcomes.length !== prices.length || outcomes.length === 0) return null;
  const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === 'yes');
  const idx = yesIdx >= 0 ? yesIdx : 0;
  const price = Number(prices[idx]);
  return Number.isFinite(price) ? price : null;
}

function relatedTickersFor(question: string): string[] {
  const q = question.toLowerCase();
  return TICKERS.filter((t) => {
    const nameWords = t.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const firstWord = nameWords.split(/\s+/)[0];
    return firstWord.length > 2 && q.includes(firstWord);
  }).map((t) => t.symbol);
}

interface ResponseCacheEntry {
  expires: number;
  value: { data: PolymarketMarket[]; generatedAt: string };
}
let responseCache: ResponseCacheEntry | null = null;

export function marketsRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      if (responseCache && responseCache.expires > Date.now()) {
        return res.json(responseCache.value);
      }

      const raw = await cachedFetchJson<GammaMarket[]>(
        'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume&ascending=false',
        10 * 60_000,
      );

      const data: PolymarketMarket[] = raw
        .map((m): PolymarketMarket | null => {
          const yesPrice = yesPriceOf(m);
          if (!m.question || yesPrice === null || !m.endDate) return null;
          return {
            id: String(m.id ?? m.question),
            question: m.question,
            category: categoryOf(m),
            yesPrice,
            volume: Number(m.volumeNum ?? m.volume ?? 0),
            liquidity: Number(m.liquidityNum ?? m.liquidity ?? 0),
            endDate: m.endDate,
            relatedTickers: relatedTickersFor(m.question),
          };
        })
        .filter((m): m is PolymarketMarket => m !== null)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 40);

      const value = { data, generatedAt: new Date().toISOString() };
      responseCache = { expires: Date.now() + 10 * 60_000, value };
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch Polymarket data', detail: String(err) });
    }
  });

  return router;
}
