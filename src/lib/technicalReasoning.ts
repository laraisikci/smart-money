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

function trendClause(price: number, sma200: number): string {
  const rel = price >= sma200 ? 'above' : 'below';
  return `Price is ${rel} its 200-day moving average ($${sma200.toFixed(2)}).`;
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
  const paragraph = `${trendClause(price, sma200)} ${lead} ${mom.text}`;
  return { paragraph, verdict };
}
