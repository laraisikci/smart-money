// Pure indicator math — no fetching, no caching, just numbers in and numbers out. Every function
// returns null when there isn't enough history to produce a real value rather than a fabricated
// or partially-computed number.

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  // Seed with the SMA of the earliest `period` values, then run the smoothing forward across the
  // rest of the series — the standard approach, rather than starting "cold" at the most recent
  // price with no prior smoothing to anchor it.
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    value = values[i] * k + value * (1 - k);
  }
  return value;
}

// Wilder's smoothing (the original, standard RSI method — not a plain moving average of gains
// and losses).
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface StochasticResult {
  k: number;
  d: number;
}

// Standard "slow" stochastic: raw %K per bar, smoothed over `kSmooth` bars for %K, then %D is a
// further `dSmooth`-bar average of that. (14, 3, 3) is the conventional default this is called
// with, matching how most charting platforms label "Stochastic %K(14,3,3)".
export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  kSmooth = 3,
  dSmooth = 3,
): StochasticResult | null {
  const n = closes.length;
  if (n < kPeriod) return null;

  const rawK: number[] = [];
  for (let i = kPeriod - 1; i < n; i++) {
    const windowHighs = highs.slice(i - kPeriod + 1, i + 1);
    const windowLows = lows.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...windowHighs);
    const lowestLow = Math.min(...windowLows);
    const range = highestHigh - lowestLow;
    // A zero range (no movement across the whole lookback) has no meaningful position within it —
    // midpoint is the least-wrong neutral reading, rather than dividing by zero.
    rawK.push(range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100);
  }
  if (rawK.length < kSmooth) return null;

  const smoothK: number[] = [];
  for (let i = kSmooth - 1; i < rawK.length; i++) {
    const window = rawK.slice(i - kSmooth + 1, i + 1);
    smoothK.push(window.reduce((a, b) => a + b, 0) / kSmooth);
  }
  if (smoothK.length < dSmooth) return null;

  const dWindow = smoothK.slice(smoothK.length - dSmooth);
  const d = dWindow.reduce((a, b) => a + b, 0) / dSmooth;
  const k = smoothK[smoothK.length - 1];
  return { k, d };
}
