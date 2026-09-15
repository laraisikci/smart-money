import { fetchYahooJson } from './newsClient.js';
import { fetchAnalystRating } from './finnhubClient.js';
import { sma, ema, rsi, stochastic } from './technicals.js';
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

// Everything except `ticker` and `analyst` — the price/chart-derived math, which is the same
// regardless of which display ticker asked for it and doesn't need Finnhub at all. Split out so
// a bulk scan across the whole tracked universe (see routes/technicals.ts) can compute this for
// every ticker without also firing an analyst-rating request per ticker — Finnhub's free tier is
// 60 calls/minute, and analyst data is irrelevant to that scan's purpose (the Conviction score's
// technical-breakdown cap) anyway.
type CoreTechnicals = Omit<TechnicalIndicators, 'ticker' | 'analyst'>;

// Pure by yahoo symbol — no dependency on the tracked TICKERS universe, so this works equally
// for a pre-tracked ticker (called via /api/technicals/:ticker) or an arbitrary ad-hoc search
// result (called via /api/search/analyze) as long as the caller already has a real Yahoo symbol.
async function computeCoreForSymbol(yahooSymbol: string): Promise<CoreTechnicals> {
  const data = await fetchYahooJson<YahooChartResponse>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${CHART_RANGE}&interval=1d`,
    CACHE_TTL_MS,
  );
  const result = data.chart.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp;
  if (!result || !quote?.close || !timestamps) throw new Error(`No price history for ${yahooSymbol}`);

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

  return {
    price: round(price),
    sma20: roundOrNull(sma(closes, 20)),
    sma50: roundOrNull(sma(closes, 50)),
    sma125: roundOrNull(sma(closes, 125)),
    sma200: roundOrNull(sma(closes, 200)),
    ema20: roundOrNull(ema(closes, 20)),
    ema50: roundOrNull(ema(closes, 50)),
    ema200: roundOrNull(ema(closes, 200)),
    rsi14: roundOrNull(rsi(closes, 14)),
    stochK: stoch ? round(stoch.k) : null,
    stochD: stoch ? round(stoch.d) : null,
    asOf: lastTs ? new Date(lastTs * 1000).toISOString() : new Date().toISOString(),
  };
}

// Keyed by yahoo symbol (not display ticker) so a pre-tracked ticker and an ad-hoc search result
// that happen to resolve to the same underlying instrument share one cache entry — and so the
// bulk scan and a single-ticker drawer fetch for the same symbol share this same cached result.
const coreCache = new Map<string, { expires: number; value: CoreTechnicals }>();
const coreInFlight = new Map<string, Promise<CoreTechnicals>>();

export async function getCoreTechnicals(yahooSymbol: string): Promise<CoreTechnicals> {
  const cached = coreCache.get(yahooSymbol);
  if (cached && cached.expires > Date.now()) return cached.value;

  let pending = coreInFlight.get(yahooSymbol);
  if (!pending) {
    pending = computeCoreForSymbol(yahooSymbol).finally(() => {
      coreInFlight.delete(yahooSymbol);
    });
    coreInFlight.set(yahooSymbol, pending);
  }
  const value = await pending;
  coreCache.set(yahooSymbol, { expires: Date.now() + CACHE_TTL_MS, value });
  return value;
}

export async function getTechnicals(displayTicker: string, yahooSymbol: string): Promise<TechnicalIndicators> {
  const [core, analyst] = await Promise.all([getCoreTechnicals(yahooSymbol), fetchAnalystRating(yahooSymbol)]);
  return { ticker: displayTicker, ...core, analyst };
}
