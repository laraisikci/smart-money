import { Router } from 'express';
import { TICKERS } from '../data/tickers.js';
import type { TickerMeta } from '../data/tickers.js';
import { fetchNewsRss } from '../lib/newsClient.js';
import { resolveTickerYahooSymbol } from '../lib/yahooSymbolResolver.js';
import { fetchGNewsHeadlines } from '../lib/gnewsClient.js';
import { xmlParser, toArray } from '../lib/xml.js';
import { classifySentiment } from '../lib/sentiment.js';
import type { NewsHeadline, TickerNews } from '../types.js';

const HEADLINES_PER_TICKER = 5;
const RESPONSE_CACHE_TTL_MS = 2 * 60 * 60_000; // 2h, per spec
const RSS_CACHE_TTL_MS = 2 * 60 * 60_000; // matches the response cache — no point outliving it
const TICKER_BATCH_SIZE = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface RssItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
}

async function fetchTickerNews(meta: TickerMeta): Promise<NewsHeadline[]> {
  const ourSymbol = meta.symbol;
  const yahooSymbol = await resolveTickerYahooSymbol(meta);
  if (!yahooSymbol) return [];

  const xml = await fetchNewsRss(
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(yahooSymbol)}`,
    RSS_CACHE_TTL_MS,
  );
  const parsed = xmlParser.parse(xml)?.rss?.channel;
  const items = toArray<RssItem>(parsed?.item);

  const headlines: NewsHeadline[] = [];
  for (const item of items) {
    if (headlines.length >= HEADLINES_PER_TICKER) break;
    const title = typeof item?.title === 'string' ? item.title : null;
    const link = typeof item?.link === 'string' ? item.link : null;
    if (!title || !link || !item?.pubDate) continue;
    const published = new Date(String(item.pubDate));
    if (Number.isNaN(published.getTime())) continue;

    headlines.push({
      ticker: ourSymbol,
      title,
      url: link,
      publishedAt: published.toISOString(),
      sentiment: classifySentiment(title),
    });
  }
  return headlines;
}

interface ResponseCacheEntry {
  expires: number;
  value: { data: TickerNews[]; generatedAt: string };
}
let responseCache: ResponseCacheEntry | null = null;

async function computeNews(): Promise<ResponseCacheEntry['value']> {
  const results: TickerNews[] = [];

  // Same batching shape as /api/insiders — bounds concurrent in-flight requests rather than one
  // Promise.all across the whole 250+ ticker universe.
  for (const batch of chunk(TICKERS, TICKER_BATCH_SIZE)) {
    const batchResults = await Promise.all(
      batch.map(async (meta): Promise<TickerNews> => {
        try {
          const headlines = await fetchTickerNews(meta);
          return { ticker: meta.symbol, headlines };
        } catch {
          return { ticker: meta.symbol, headlines: [] };
        }
      }),
    );
    results.push(...batchResults);
  }

  return {
    data: results.filter((r) => r.headlines.length > 0),
    generatedAt: new Date().toISOString(),
  };
}

// Same request-coalescing as /api/insiders — a second request arriving mid-computation awaits
// the same in-flight promise instead of independently kicking off a full 250+ ticker scan.
let inFlight: Promise<ResponseCacheEntry['value']> | null = null;

// Single-ticker fetches (below) are naturally bounded by actual user interaction — someone
// opening one ticker's detail view — rather than a bulk scan, so this is the only place GNews
// gets tried (its free tier is 100 requests/day, nowhere near enough for the full universe).
// Cached the same 2h as the bulk endpoint regardless of which source answered.
const singleTickerCache = new Map<string, { expires: number; value: NewsHeadline[] }>();
const SINGLE_TICKER_CACHE_TTL_MS = 2 * 60 * 60_000;

export function newsRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      if (responseCache && responseCache.expires > Date.now()) {
        return res.json(responseCache.value);
      }
      if (!inFlight) {
        inFlight = computeNews().finally(() => {
          inFlight = null;
        });
      }
      const value = await inFlight;
      responseCache = { expires: Date.now() + RESPONSE_CACHE_TTL_MS, value };
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch news', detail: String(err) });
    }
  });

  router.get('/:ticker', async (req, res) => {
    const symbol = req.params.ticker.toUpperCase();
    const meta = TICKERS.find((t) => t.symbol === symbol);
    if (!meta) {
      return res.status(404).json({ error: `Unknown ticker: ${symbol}` });
    }

    const cached = singleTickerCache.get(symbol);
    if (cached && cached.expires > Date.now()) {
      return res.json({ data: cached.value, generatedAt: new Date().toISOString(), source: 'cache' });
    }

    try {
      const gnews = await fetchGNewsHeadlines(symbol, `${meta.name} stock`);
      const headlines = gnews ?? (await fetchTickerNews(meta));
      singleTickerCache.set(symbol, { expires: Date.now() + SINGLE_TICKER_CACHE_TTL_MS, value: headlines });
      res.json({ data: headlines, generatedAt: new Date().toISOString(), source: gnews ? 'gnews' : 'yahoo' });
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch news', detail: String(err) });
    }
  });

  return router;
}
