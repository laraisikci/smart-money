import type { TechnicalIndicators } from '@/types';

export type Zone = 'Overbought' | 'Oversold' | 'Neutral';
export type Verdict = 'Bullish' | 'Bearish' | 'Mixed' | 'Caution';

export function rsiZone(rsi: number): Zone {
  if (rsi >= 70) return 'Overbought';
  if (rsi <= 30) return 'Oversold';
  return 'Neutral';
}

export function stochZone(k: number): Zone {
  if (k >= 80) return 'Overbought';
  if (k <= 20) return 'Oversold';
  return 'Neutral';
}

export function vsAverage(price: number, avg: number): 'Above' | 'Below' {
  return price >= avg ? 'Above' : 'Below';
}

export interface TechnicalReasoning {
  paragraph: string;
  verdict: Verdict;
}

export interface TechnicalScore {
  score: number; // 0-100
  detail: string;
}

// Slower-moving averages carry more weight than fast ones — the same logic as why the reasoning
// above anchors its trend read on SMA200 rather than SMA20: a price crossing its 20-day average
// is common noise, crossing its 200-day average is a real trend change.
const MA_WEIGHTS: {
  key: 'sma20' | 'sma50' | 'sma125' | 'sma200' | 'ema20' | 'ema50' | 'ema200';
  weight: number;
}[] = [
  { key: 'sma20', weight: 1 },
  { key: 'ema20', weight: 1 },
  { key: 'sma50', weight: 1.5 },
  { key: 'ema50', weight: 1.5 },
  { key: 'sma125', weight: 1.75 },
  { key: 'sma200', weight: 2 },
  { key: 'ema200', weight: 2 },
];

const TREND_WEIGHT = 0.6;
const MOMENTUM_WEIGHT = 0.4;

/**
 * A single weighted 0-100 read across every indicator in the Technical Analysis section — 60%
 * from where price sits relative to each moving average (weighted toward the slower, more
 * significant ones), 40% from RSI/Stochastic momentum. Deliberately a coarser, continuous
 * measure than the bucketed verdict above (Bullish/Bearish/Mixed/Caution) — same relationship
 * newsSignal()'s numeric score has to the separate aggregateSentiment() bucket in conviction.ts,
 * so a "Mixed" verdict next to a 70%+ score isn't a contradiction, just two different views of
 * the same data (verdict accounts for conflicting signals discounting confidence; the score here
 * doesn't).
 */
export function technicalScore(ind: TechnicalIndicators): TechnicalScore | null {
  const available = MA_WEIGHTS.filter((m) => ind[m.key] !== null);
  if (available.length === 0 || ind.rsi14 === null || ind.stochK === null) return null;

  const totalWeight = available.reduce((sum, m) => sum + m.weight, 0);
  const aboveWeight = available.reduce((sum, m) => {
    const value = ind[m.key] as number;
    return sum + (ind.price > value ? m.weight : 0);
  }, 0);
  const trendScore = (aboveWeight / totalWeight) * 100;
  const momentumScore = (ind.rsi14 + ind.stochK) / 2;

  const score = Math.round(trendScore * TREND_WEIGHT + momentumScore * MOMENTUM_WEIGHT);
  const aboveCount = available.filter((m) => ind.price > (ind[m.key] as number)).length;
  const detail = `Price above ${aboveCount}/${available.length} moving averages · RSI ${ind.rsi14.toFixed(0)} · Stoch ${ind.stochK.toFixed(0)}`;
  return { score: Math.max(0, Math.min(100, score)), detail };
}

function trendClause(price: number, sma200: number): string {
  const rel = price >= sma200 ? 'above' : 'below';
  return `Price is ${rel} its 200-day moving average ($${sma200.toFixed(2)}).`;
}

// A separate, standalone clause rather than a new verdict branch — SMA125 sits between the
// existing 50/200-day reads this function already anchors its verdict on, so it adds color
// ("recovering" vs. "fully confirmed") without changing what the verdict itself concludes.
function sma125Clause(price: number, sma125: number | null, sma200: number): string | null {
  if (sma125 === null) return null;
  const aboveSma125 = price >= sma125;
  const aboveSma200 = price >= sma200;
  if (aboveSma125 && !aboveSma200) return 'Recovering but not yet in long-term uptrend.';
  if (aboveSma125 && aboveSma200) return 'Strong trend confirmation across all timeframes.';
  return null;
}

function momentumClause(rsi: number, stochK: number): { text: string; agree: boolean } {
  const rsiZoneVal = rsiZone(rsi);
  const stochZoneVal = stochZone(stochK);
  const agree = rsiZoneVal === stochZoneVal;
  const text = `RSI is at ${rsi.toFixed(1)} (${rsiZoneVal.toLowerCase()}) and Stochastic %K is at ${stochK.toFixed(1)} (${stochZoneVal.toLowerCase()}), so the two momentum readings ${agree ? 'agree' : 'conflict'}.`;
  return { text, agree };
}

// Rule-based, not statistical or ML-driven — matches how every other "reasoning" function in
// this app works (conviction.ts, macroSectors.ts, newsSentiment.ts). Returns null when there
// isn't enough price history to reason honestly (a newly-tracked ticker without 200 days yet).
export function reasonAboutTechnicals(ind: TechnicalIndicators): TechnicalReasoning | null {
  if (ind.sma200 === null || ind.rsi14 === null || ind.stochK === null) return null;

  const price = ind.price;
  const sma200 = ind.sma200;
  const rsi = ind.rsi14;
  const stochK = ind.stochK;

  const aboveSma200 = price > sma200;
  const aboveSma50 = ind.sma50 !== null && price > ind.sma50;
  const rsiOverbought = rsi >= 70;
  const stochOverbought = stochK >= 80;
  const bothOverbought = rsiOverbought && stochOverbought;
  const bullishStack =
    ind.ema20 !== null && ind.ema50 !== null && ind.ema20 > ind.ema50 && ind.ema50 > sma200 && aboveSma200;
  const bearishStack = ind.ema20 !== null && ind.ema50 !== null && ind.ema20 < ind.ema50 && !aboveSma200;

  let lead: string;
  let verdict: Verdict;

  if (bothOverbought) {
    lead =
      'Both RSI and Stochastic are in overbought territory simultaneously — this often precedes a short-term pullback even in strong uptrends. Consider waiting for a cooldown.';
    verdict = 'Caution';
  } else if (bullishStack) {
    lead =
      'Full bullish alignment — short, medium, and long-term averages are all stacked in the right order with price above all of them. This is a textbook bullish technical setup.';
    verdict = 'Bullish';
  } else if (bearishStack) {
    lead =
      'Bearish technical picture — the stock is below its long-term average and short-term momentum is weakening. Not a favorable technical entry.';
    verdict = 'Bearish';
  } else if (aboveSma200 && rsi < 60 && stochK < 80) {
    lead =
      "This stock is in a long-term uptrend and not yet overbought — technically a favorable entry zone. The stochastic confirms momentum hasn't peaked.";
    verdict = 'Bullish';
  } else if (!aboveSma200 && aboveSma50) {
    lead =
      'Mixed signals — the stock is below its long-term trend but holding above medium-term support. Watch for a move above the 200-day average to confirm recovery.';
    verdict = 'Mixed';
  } else if (aboveSma200) {
    // Above the long-term trend but didn't match the clean "favorable entry" pattern above
    // (e.g. RSI or Stochastic already stretched without both being overbought).
    lead =
      'The long-term trend is up, though momentum is running hot enough that this is a less clean setup than a fresh breakout.';
    verdict = 'Mixed';
  } else {
    lead =
      'The long-term trend is down, which keeps the technical picture cautious even without a stronger confirming signal.';
    verdict = 'Bearish';
  }

  const mom = momentumClause(rsi, stochK);
  const sma125Text = sma125Clause(price, ind.sma125, sma200);
  const paragraph = [trendClause(price, sma200), lead, mom.text, sma125Text].filter(Boolean).join(' ');
  return { paragraph, verdict };
}
