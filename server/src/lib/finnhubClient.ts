import { fetchWithTimeout } from './fetchTimeout.js';
import type { AnalystRating, AnalystRecommendationDistribution } from '../types.js';

// Replaces the old Yahoo quoteSummary cookie+crumb flow (see yahooAuth.ts, now unused) — verified
// live on Render that Yahoo blocks that undocumented endpoint outright for Render's IP (getcrumb
// returned 429 even on a single cold, isolated request, not just under repeated load). Finnhub's
// free tier covers the same data through a real, documented, keyed API — no reverse-engineered
// auth needed. Coverage caveat, from Finnhub's own docs: reliable for US-listed tickers; European
// exchange coverage on the free plan is inconsistent, so this degrades to null per-ticker exactly
// like every other "best effort" data source in this app rather than guessing.
const BASE_URL = 'https://finnhub.io/api/v1';
const RECOMMENDATION_LABELS = ['strongBuy', 'buy', 'hold', 'sell', 'strongSell'] as const;

interface RecommendationTrendEntry {
  buy?: number;
  hold?: number;
  period?: string;
  sell?: number;
  strongBuy?: number;
  strongSell?: number;
  symbol?: string;
}

interface PriceTargetResponse {
  targetMean?: number;
  targetHigh?: number;
  targetLow?: number;
  targetMedian?: number;
  lastUpdated?: string;
}

async function finnhubGet<T>(path: string, params: Record<string, string>, apiKey: string): Promise<T | null> {
  const query = new URLSearchParams({ ...params, token: apiKey }).toString();
  const res = await fetchWithTimeout(`${BASE_URL}${path}?${query}`);
  if (!res.ok) {
    console.error(`[finnhubClient] ${path} failed — status ${res.status} ${res.statusText}`);
    return null;
  }
  return (await res.json()) as T;
}

// Finnhub gives buy/hold/sell counts, not Yahoo's opaque 1-5 "recommendationMean" — this derives
// the same kind of scalar (1 = Strong Buy ... 5 = Strong Sell) from the actual counts, which is
// if anything more transparent than what it replaces.
function weightedMean(dist: AnalystRecommendationDistribution): number {
  const total = dist.strongBuy + dist.buy + dist.hold + dist.sell + dist.strongSell;
  if (total === 0) return 3;
  const weighted = dist.strongBuy * 1 + dist.buy * 2 + dist.hold * 3 + dist.sell * 4 + dist.strongSell * 5;
  return weighted / total;
}

function meanToKey(mean: number): string {
  const idx = Math.max(0, Math.min(4, Math.round(mean) - 1));
  return RECOMMENDATION_LABELS[idx];
}

/**
 * Best-effort, same contract as the code it replaces — returns null on any failure (no API key
 * configured, request error, no data for this symbol) so the caller always has a clean way to
 * say "no analyst data" rather than guessing.
 */
export async function fetchAnalystRating(symbol: string): Promise<AnalystRating | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  try {
    const [trends, target] = await Promise.all([
      finnhubGet<RecommendationTrendEntry[]>('/stock/recommendation', { symbol }, apiKey),
      finnhubGet<PriceTargetResponse>('/stock/price-target', { symbol }, apiKey),
    ]);

    // Trends are returned newest-period-first; the most recent entry is "what analysts think
    // right now" (older entries are the same breakdown for prior months).
    const latest = trends?.[0];
    if (!latest) {
      console.error(`[finnhubClient] ${symbol}: no recommendation trend data`);
      return null;
    }

    const distribution: AnalystRecommendationDistribution = {
      strongBuy: latest.strongBuy ?? 0,
      buy: latest.buy ?? 0,
      hold: latest.hold ?? 0,
      sell: latest.sell ?? 0,
      strongSell: latest.strongSell ?? 0,
    };
    const numberOfAnalysts = distribution.strongBuy + distribution.buy + distribution.hold + distribution.sell + distribution.strongSell;
    if (numberOfAnalysts === 0) {
      console.error(`[finnhubClient] ${symbol}: recommendation trend present but all-zero counts`);
      return null;
    }

    const mean = weightedMean(distribution);

    return {
      recommendationMean: mean,
      recommendationKey: meanToKey(mean),
      numberOfAnalysts,
      targetMeanPrice: target?.targetMean ?? null,
      distribution,
    };
  } catch (err) {
    console.error(`[finnhubClient] ${symbol}: threw —`, err);
    return null;
  }
}
