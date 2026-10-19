import type { TechnicalIndicators } from '@/types';

export type TrendLabel = 'Uptrend' | 'Downtrend' | 'Sideways';

// Within ±2% of the 200-day average isn't a meaningful trend call either way.
const SIDEWAYS_BAND_PCT = 2;

// Single trend label from SMA200 position only — deliberately simple, so it's explainable at a
// glance on a card; the detail view has the full technical read.
export function trendLabel(t: TechnicalIndicators | null | undefined): TrendLabel | null {
  if (!t || t.sma200 == null) return null;
  const pct = ((t.price - t.sma200) / t.sma200) * 100;
  if (pct > SIDEWAYS_BAND_PCT) return 'Uptrend';
  if (pct < -SIDEWAYS_BAND_PCT) return 'Downtrend';
  return 'Sideways';
}

// Negative number: how far below the 52-week high the price sits (0 at the high).
export function distanceFrom52wHigh(t: TechnicalIndicators | null | undefined): number | null {
  if (!t || t.high52w == null || t.high52w <= 0) return null;
  return ((t.price - t.high52w) / t.high52w) * 100;
}

const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF ', DKK: 'kr ', SEK: 'kr ', NOK: 'kr ' };
export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? '';
}

export const TREND_STYLE: Record<TrendLabel, string> = {
  Uptrend: 'text-bull-400',
  Downtrend: 'text-bear-400',
  Sideways: 'text-warn-400',
};
