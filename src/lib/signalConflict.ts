import type { ConvictionResult, TechnicalIndicators } from '@/types';
import { reasonAboutTechnicals } from './technicalReasoning';

export type SmartMoneyDirection = 'Bullish' | 'Bearish' | 'Neutral';

// Same insider+institution averaging fullAnalysis.ts's smartMoneyClause already does — pulled
// out here so the Conviction tab's cap/badge/filter and the Full Analysis paragraph agree on
// what "smart money is bullish" means, rather than two independent definitions drifting apart.
export function smartMoneyDirection(result: ConvictionResult): SmartMoneyDirection | null {
  const insider = result.signals.find((s) => s.type === 'insider');
  const institution = result.signals.find((s) => s.type === 'institution');
  if (!insider && !institution) return null;

  let sum = 0;
  let count = 0;
  if (insider) {
    sum += insider.score;
    count++;
  }
  if (institution) {
    sum += institution.score;
    count++;
  }
  const avg = sum / count;
  return avg >= 55 ? 'Bullish' : avg <= 45 ? 'Bearish' : 'Neutral';
}

const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;
const STOCH_OVERSOLD = 20;
export const TECHNICAL_BREAKDOWN_CAP = 45;

// All four conditions at once — price below its long-term trend, momentum at an extreme, a
// death cross, and Stochastic confirming oversold — describes a stock in full technical
// breakdown. A stock in that state can't be genuinely "high conviction" no matter how strong the
// insider/institutional signal reads: it means the thesis hasn't played out in price yet.
export function isFullTechnicalBreakdown(ind: TechnicalIndicators): boolean {
  if (ind.sma200 === null || ind.rsi14 === null || ind.stochK === null || ind.ema20 === null || ind.ema50 === null) {
    return false;
  }
  const belowSma200 = ind.price < ind.sma200;
  const rsiExtreme = ind.rsi14 > RSI_OVERBOUGHT || ind.rsi14 < RSI_OVERSOLD;
  const deathCross = ind.ema20 < ind.ema50;
  const stochOversold = ind.stochK < STOCH_OVERSOLD;
  return belowSma200 && rsiExtreme && deathCross && stochOversold;
}

// Caps the Conviction score when the ticker is in full technical breakdown, regardless of how
// strong the underlying insider/institutional signal is. `technicals` may be null/undefined while
// the bulk technicals scan is still loading — in that case the score is left untouched rather
// than guessing.
export function applyConvictionCap(score: number, technicals: TechnicalIndicators | null | undefined): number {
  if (technicals && isFullTechnicalBreakdown(technicals)) return Math.min(score, TECHNICAL_BREAKDOWN_CAP);
  return score;
}

export function technicalsVerdict(technicals: TechnicalIndicators | null | undefined): 'Bullish' | 'Bearish' | 'Mixed' | 'Caution' | null {
  if (!technicals) return null;
  return reasonAboutTechnicals(technicals)?.verdict ?? null;
}

export interface SignalAlignment {
  // Smart money bullish, technicals majority bearish — the specific "wait for confirmation"
  // conflict this feature is about. Not the same as isFullTechnicalBreakdown: that's the extreme
  // case that caps the score outright; this fires on a plain bearish technical read too.
  hasConflict: boolean;
  breakdown: boolean;
  // Both sides genuinely bullish at once — the "Confirmed only" filter's bar.
  confirmed: boolean;
}

export function evaluateSignalAlignment(result: ConvictionResult, technicals: TechnicalIndicators | null | undefined): SignalAlignment {
  const smartMoney = smartMoneyDirection(result);
  const techVerdict = technicalsVerdict(technicals);
  const breakdown = technicals ? isFullTechnicalBreakdown(technicals) : false;
  const hasConflict = smartMoney === 'Bullish' && techVerdict === 'Bearish';
  const confirmed = smartMoney === 'Bullish' && techVerdict === 'Bullish';
  return { hasConflict, breakdown, confirmed };
}
