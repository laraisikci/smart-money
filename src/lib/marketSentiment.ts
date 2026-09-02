import type { AnalystRating, MacroIndicator, NewsHeadline } from '@/types';
import { aggregateSentiment, recentHeadlines } from '@/lib/newsSentiment';

export type MarketSentimentLabel = 'Bullish' | 'Neutral' | 'Bearish';

export interface MarketSentimentResult {
  label: MarketSentimentLabel;
  score: number; // 0-100, 50 = perfectly neutral
}

// Spec weights: news 30%, Fear & Greed 25%, analyst consensus 30%, Put/Call ratio 15%. Each
// component is scored 0-100 first (100 = most bullish) so they combine on one scale, then
// weights re-normalize over whichever components actually have data — same "only weight what's
// active" approach as computeConviction in conviction.ts, so a missing Put/Call ratio (no free
// data source exists for it — see server/routes/macro.ts) just drops out cleanly instead of
// forcing a fabricated neutral value into the blend.
const WEIGHTS = { news: 0.3, fearGreed: 0.25, analyst: 0.3, putCall: 0.15 };

function newsScore(headlines: NewsHeadline[]): number | null {
  const recent = recentHeadlines(headlines);
  if (recent.length === 0) return null;
  const agg = aggregateSentiment(recent);
  if (agg === 'Bullish') return 75;
  if (agg === 'Bearish') return 25;
  return 50;
}

// Yahoo's recommendationMean: 1 = Strong Buy ... 5 = Strong Sell — inverted onto a 0(bearish)-
// 100(bullish) scale.
function analystScore(rating: AnalystRating): number {
  return Math.max(0, Math.min(100, ((5 - rating.recommendationMean) / 4) * 100));
}

// Below 0.7 = bullish/complacent, above 1.0 = bearish, per spec. Linearly interpolated between
// those two anchor points and clamped, rather than a hard step function, so a ratio of 0.85
// reads as mildly-bullish-leaning-neutral instead of jumping straight from 100 to 0.
function putCallScore(ratio: number): number {
  const t = (1.0 - ratio) / (1.0 - 0.7);
  return Math.max(0, Math.min(100, t * 100));
}

export function computeMarketSentiment(params: {
  headlines: NewsHeadline[];
  fearGreed: MacroIndicator | null;
  analyst: AnalystRating | null;
  putCallRatio: MacroIndicator | null;
}): MarketSentimentResult | null {
  const components: { score: number; weight: number }[] = [];

  const n = newsScore(params.headlines);
  if (n !== null) components.push({ score: n, weight: WEIGHTS.news });

  if (params.fearGreed) components.push({ score: params.fearGreed.value, weight: WEIGHTS.fearGreed });

  if (params.analyst) components.push({ score: analystScore(params.analyst), weight: WEIGHTS.analyst });

  if (params.putCallRatio) components.push({ score: putCallScore(params.putCallRatio.value), weight: WEIGHTS.putCall });

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weighted = components.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight;
  const score = Math.round(weighted);
  const label: MarketSentimentLabel = score >= 60 ? 'Bullish' : score <= 40 ? 'Bearish' : 'Neutral';
  return { label, score };
}
