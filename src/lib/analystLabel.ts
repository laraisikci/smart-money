// Yahoo's recommendationKey isn't consistently cased across tickers — some come back
// camelCase ("strongBuy"), others snake_case ("strong_buy") — verified directly against live
// data (DTE returns snake_case, AAPL returns plain "buy"). Normalizing before lookup avoids
// silently falling through to the raw key as a label.
function normalize(key: string): string {
  return key.replace(/_/g, '').toLowerCase();
}

const LABELS: Record<string, string> = {
  strongbuy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  sell: 'Sell',
  strongsell: 'Strong Sell',
  none: 'No Rating',
};

export function recommendationLabel(key: string): string {
  return LABELS[normalize(key)] ?? key;
}

export type RecommendationLean = 'bullish' | 'bearish' | 'neutral';

export function recommendationLean(key: string): RecommendationLean {
  const norm = normalize(key);
  if (norm === 'strongbuy' || norm === 'buy') return 'bullish';
  if (norm === 'strongsell' || norm === 'sell') return 'bearish';
  return 'neutral';
}
