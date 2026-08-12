import type { NewsHeadline, Sentiment } from '@/types';
import { daysAgo } from '@/lib/format';

export const NEWS_MAX_AGE_DAYS = 7;

export function recentHeadlines(headlines: NewsHeadline[], maxAgeDays = NEWS_MAX_AGE_DAYS): NewsHeadline[] {
  return headlines.filter((h) => daysAgo(h.publishedAt) <= maxAgeDays);
}

export type AggregateSentiment = 'Bullish' | 'Bearish' | 'Mixed';

// "Mixed" covers both genuinely mixed signals and no signal at all (everything Neutral, or no
// headlines) — in both cases there's no clean bullish/bearish read, which is the honest thing to
// show. Same logic as the server's aggregateSentiment() in sentiment.ts — duplicated rather than
// shared across the client/server boundary, but kept in sync intentionally: this one operates on
// already-fetched NewsHeadline objects, not raw strings.
export function aggregateSentiment(headlines: NewsHeadline[]): AggregateSentiment {
  const positive = headlines.filter((h) => h.sentiment === 'Positive').length;
  const negative = headlines.filter((h) => h.sentiment === 'Negative').length;
  if (positive === 0 && negative === 0) return 'Mixed';
  if (positive > negative) return 'Bullish';
  if (negative > positive) return 'Bearish';
  return 'Mixed';
}

export const SENTIMENT_DIRECTION: Record<Sentiment, { emoji: string; label: string }> = {
  Positive: { emoji: '📈', label: 'Likely positive for stock' },
  Negative: { emoji: '📉', label: 'Likely negative for stock' },
  Neutral: { emoji: '➡️', label: 'Neutral impact' },
};

export const AGGREGATE_BADGE: Record<AggregateSentiment, { emoji: string; label: string }> = {
  Bullish: { emoji: '🟢', label: 'Bullish news' },
  Bearish: { emoji: '🔴', label: 'Bearish news' },
  Mixed: { emoji: '⚪', label: 'Mixed news' },
};
