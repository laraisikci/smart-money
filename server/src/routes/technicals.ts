import { Router } from 'express';
import { TICKERS } from '../data/tickers.js';
import { resolveTickerYahooSymbol } from '../lib/yahooSymbolResolver.js';
import { fetchYahooJson } from '../lib/newsClient.js';
import { fetchAnalystRating } from '../lib/analystClient.js';
import { sma, ema, rsi, stochastic } from '../lib/technicals.js';
import type { TechnicalIndicators } from '../types.js';

const CACHE_TTL_MS = 4 * 60 * 60_000; // 4h, per spec
const CHART_RANGE = '2y'; // ~500 daily bars — enough history for a stable SMA/EMA 200, not just the bare minimum

interface YahooChartResponse {
  chart: {
    result?: [
      {
        meta?: { regularMarketPrice?: number };
        timestamp?: number[];
        indicators?: {
          quote?: [{ close?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[] }];
        };
      },
    ];
  };
}

function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
function roundOrNull(n: number | null, decimals = 2): number | null {
  return n === null ? null : round(n, decimals);
}

async function computeTechnicals(ticker: string): Promise<TechnicalIndicators> {
  const meta = TICKERS.find((t) => t.symbol === ticker);
  if (!meta) throw new Error(`Unknown ticker: ${ticker}`);

  const yahooSymbol = await resolveTickerYahooSymbol(meta);
  if (!yahooSymbol) throw new Error(`Could not resolve a Yahoo symbol for ${ticker}`);

  const data = await fetchYahooJson<YahooChartResponse>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${CHART_RANGE}&interval=1d`,
    CACHE_TTL_MS,
  );
  const result = data.chart.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp;
  if (!result || !quote?.close || !timestamps) throw new Error(`No price history for ${ticker}`);

  // Yahoo's daily series carries a null close for today's still-forming session (and occasional
  // gaps) — filter those out so every indicator is computed from real closed bars only, never an
  // in-progress or missing one.
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  let lastTs = 0;
  for (let i = 0; i < timestamps.length; i++) {
    const c = quote.close[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    if (c == null || h == null || l == null) continue;
    closes.push(c);
    highs.push(h);
    lows.push(l);
    lastTs = timestamps[i];
  }

  const price = result.meta?.regularMarketPrice ?? closes[closes.length - 1];
  const stoch = stochastic(highs, lows, closes, 14, 3, 3);
  const analyst = await fetchAnalystRating(yahooSymbol);

  return {
    ticker,
    price: round(price),
    sma20: roundOrNull(sma(closes, 20)),
    sma50: roundOrNull(sma(closes, 50)),
    sma200: roundOrNull(sma(closes, 200)),
    ema20: roundOrNull(ema(closes, 20)),
    ema50: roundOrNull(ema(closes, 50)),
    ema200: roundOrNull(ema(closes, 200)),
    rsi14: roundOrNull(rsi(closes, 14)),
    stochK: stoch ? round(stoch.k) : null,
    stochD: stoch ? round(stoch.d) : null,
    analyst,
    asOf: lastTs ? new Date(lastTs * 1000).toISOString() : new Date().toISOString(),
  };
}

const cache = new Map<string, { expires: number; value: TechnicalIndicators }>();
const inFlight = new Map<string, Promise<TechnicalIndicators>>();

export function technicalsRouter(): Router {
  const router = Router();

  router.get('/:ticker', async (req, res) => {
    const symbol = req.params.ticker.toUpperCase();
    const meta = TICKERS.find((t) => t.symbol === symbol);
    if (!meta) {
      return res.status(404).json({ error: `Unknown ticker: ${symbol}` });
    }

    const cached = cache.get(symbol);
    if (cached && cached.expires > Date.now()) {
      return res.json({ data: cached.value });
    }

    try {
      let pending = inFlight.get(symbol);
      if (!pending) {
        pending = computeTechnicals(symbol).finally(() => {
          inFlight.delete(symbol);
        });
        inFlight.set(symbol, pending);
      }
      const value = await pending;
      cache.set(symbol, { expires: Date.now() + CACHE_TTL_MS, value });
      res.json({ data: value });
    } catch (err) {
      res.status(502).json({ error: 'Failed to compute technical indicators', detail: String(err) });
    }
  });

  return router;
}
