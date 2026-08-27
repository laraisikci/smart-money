import type {
  InstitutionalPosition,
  InstitutionalStance,
  NewsHeadline,
  SnapshotSentiment,
  TechnicalIndicators,
  WatchlistSnapshot,
} from '@/types';
import { aggregateSentiment, recentHeadlines } from '@/lib/newsSentiment';

// Same bullish/bearish counting logic institutionSignal() in conviction.ts already uses to score
// this signal — reused here as a plain up/down/flat readout rather than a 0-100 score, since the
// Watchlist card shows "increasing/decreasing/neutral" not a number.
export function computeInstitutionalStance(positions: InstitutionalPosition[]): InstitutionalStance {
  const bullish = positions.filter((p) => p.action === 'new' || p.action === 'increased').length;
  const bearish = positions.filter((p) => p.action === 'decreased' || p.action === 'exited').length;
  if (bullish === 0 && bearish === 0) return 'neutral';
  if (bullish > bearish) return 'increasing';
  if (bearish > bullish) return 'decreasing';
  return 'neutral';
}

export function computeSnapshotSentiment(headlines: NewsHeadline[]): SnapshotSentiment {
  const agg = aggregateSentiment(recentHeadlines(headlines));
  if (agg === 'Bullish') return 'positive';
  if (agg === 'Bearish') return 'negative';
  return 'neutral';
}

export function buildWatchlistSnapshot(params: {
  convictionScore: number;
  technicals: TechnicalIndicators | null;
  institutions: InstitutionalPosition[];
  news: NewsHeadline[];
}): WatchlistSnapshot {
  const { convictionScore, technicals, institutions, news } = params;
  return {
    convictionScore,
    rsi: technicals?.rsi14 ?? null,
    stochK: technicals?.stochK ?? null,
    vsSma50: technicals?.sma50 != null ? (technicals.price >= technicals.sma50 ? 'above' : 'below') : null,
    vsSma200: technicals?.sma200 != null ? (technicals.price >= technicals.sma200 ? 'above' : 'below') : null,
    institutionalStance: computeInstitutionalStance(institutions),
    newsSentiment: computeSnapshotSentiment(news),
  };
}
