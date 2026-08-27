import type { MacroIndicator, MacroIndicatorId, Sector, WatchlistSnapshot } from '@/types';
import type { SectorPulse } from '@/lib/macroSectors';

export type SignalHealthLevel = 'Intact' | 'Weakening' | 'ConsiderExit';

export interface SignalHealth {
  level: SignalHealthLevel;
  emoji: string;
  label: string;
  reason: string;
}

const CONSIDER_EXIT_DROP = 25;
const WEAKENING_DROP = 10;

// Compares the snapshot taken at add-time against a freshly-built snapshot of the same shape
// (see buildWatchlistSnapshot) to decide whether the original thesis still holds. Checked in
// order from most to least severe so a stock that qualifies for Consider Exit never also gets
// reported as merely Weakening.
export function computeSignalHealth(entry: WatchlistSnapshot, current: WatchlistSnapshot): SignalHealth {
  const convictionDrop = entry.convictionScore - current.convictionScore;

  const rsiFlippedHot = entry.rsi !== null && current.rsi !== null && entry.rsi < 50 && current.rsi > 65;
  const brokeSma50 = entry.vsSma50 === 'above' && current.vsSma50 === 'below';
  const brokeSma200 = entry.vsSma200 === 'above' && current.vsSma200 === 'below';
  const stanceDowngraded = entry.institutionalStance !== 'decreasing' && current.institutionalStance === 'decreasing';
  const sentimentDowngraded = entry.newsSentiment !== 'negative' && current.newsSentiment === 'negative';

  const reversedCount = [rsiFlippedHot || brokeSma50, stanceDowngraded, sentimentDowngraded].filter(Boolean).length;
  const majorityReversed = reversedCount >= 2;

  if (convictionDrop > CONSIDER_EXIT_DROP) {
    return {
      level: 'ConsiderExit',
      emoji: '🔴',
      label: 'Consider Exit',
      reason: `Conviction dropped from ${entry.convictionScore} → ${current.convictionScore} since added`,
    };
  }
  if (brokeSma200) {
    return {
      level: 'ConsiderExit',
      emoji: '🔴',
      label: 'Consider Exit',
      reason: 'Price broke below its 200-day moving average since added',
    };
  }
  if (majorityReversed) {
    return {
      level: 'ConsiderExit',
      emoji: '🔴',
      label: 'Consider Exit',
      reason: 'Majority of signals have reversed since added',
    };
  }
  if (convictionDrop >= WEAKENING_DROP) {
    return {
      level: 'Weakening',
      emoji: '🟡',
      label: 'Weakening',
      reason: `Conviction dropped from ${entry.convictionScore} → ${current.convictionScore} since added`,
    };
  }
  if (rsiFlippedHot && entry.rsi !== null && current.rsi !== null) {
    return {
      level: 'Weakening',
      emoji: '🟡',
      label: 'Weakening',
      reason: `RSI moved from ${entry.rsi.toFixed(0)} → ${current.rsi.toFixed(0)} since added`,
    };
  }
  if (brokeSma50) {
    return {
      level: 'Weakening',
      emoji: '🟡',
      label: 'Weakening',
      reason: 'Price dropped below its 50-day moving average since added',
    };
  }

  return {
    level: 'Intact',
    emoji: '🟢',
    label: 'Intact',
    reason: 'Signals holding steady since added',
  };
}

const RSI_OVERBOUGHT = 70;
const STOCH_OVERBOUGHT = 80;
const SMA200_STRETCH_PCT = 0.15;
export const EXIT_SCORE_OVERBOUGHT_THRESHOLD = 65;

export function computeExitScore(current: {
  rsi: number | null;
  stochK: number | null;
  price: number | null;
  sma200: number | null;
  analystTarget: number | null;
}): number {
  let score = 0;
  if (current.rsi !== null && current.rsi > RSI_OVERBOUGHT) score += 30;
  if (current.stochK !== null && current.stochK > STOCH_OVERBOUGHT) score += 25;
  if (current.price !== null && current.sma200 !== null && current.price > current.sma200 * (1 + SMA200_STRETCH_PCT)) {
    score += 25;
  }
  if (current.price !== null && current.analystTarget !== null && current.price > current.analystTarget) {
    score += 20;
  }
  return Math.min(100, score);
}

const VIX_HIGH = 25;
const OIL_SHARP_RISE_PCT = 3;
const RATE_SENSITIVE_SECTORS: Sector[] = ['RealEstate', 'Utilities', 'Consumer'];
const HIGH_GROWTH_SECTORS: Sector[] = ['Tech'];
const EU_EXPORTER_SECTORS: Sector[] = ['Tech', 'Industrials'];
const OIL_SENSITIVE_SECTORS: Sector[] = ['Consumer', 'Industrials'];

// Mirrors the same macro-to-sector reasoning as computeSectorPulse in macroSectors.ts, but
// framed as plain-English exit-relevant warnings for one specific stock rather than a full
// sector heatmap. Also pulls the heatmap's own Headwind reason directly when this stock's
// sector is already flagged there, so the two views of the same macro data never disagree.
export function computeMacroWarnings(
  sector: Sector,
  market: 'EU' | 'US',
  indicators: MacroIndicator[],
  sectorPulses: SectorPulse[],
): string[] {
  const byId = new Map<MacroIndicatorId, MacroIndicator>(indicators.map((i) => [i.id, i]));
  const ecbRate = byId.get('ecbRate');
  const eurUsd = byId.get('eurUsd');
  const brent = byId.get('brent');
  const vix = byId.get('vix');

  const warnings = new Set<string>();

  if (ecbRate && ecbRate.change > 0 && RATE_SENSITIVE_SECTORS.includes(sector)) {
    warnings.add('Rising rates — sector headwind');
  }
  if (vix && vix.value > VIX_HIGH && HIGH_GROWTH_SECTORS.includes(sector)) {
    warnings.add('High market fear — consider reducing risk');
  }
  if (eurUsd && eurUsd.change > 0 && market === 'EU' && EU_EXPORTER_SECTORS.includes(sector)) {
    warnings.add('Strong EUR hurts exporters');
  }
  const oilRisingSharply = !!brent && (brent.changePercent ?? 0) > OIL_SHARP_RISE_PCT;
  if (oilRisingSharply && OIL_SENSITIVE_SECTORS.includes(sector)) {
    warnings.add('Rising oil — margin pressure');
  }

  const pulse = sectorPulses.find((p) => p.sector === sector);
  if (pulse && pulse.signal === 'Headwind') {
    warnings.add(pulse.reason);
  }

  return Array.from(warnings);
}

export interface WatchlistVerdict {
  emoji: string;
  text: string;
}

// One line combining all three exit signals — thesis (Signal Health), overbought (Exit Score),
// and macro headwind — by simple negative-signal count, per the spec's exact four-tier wording.
export function computeVerdict(health: SignalHealthLevel, overbought: boolean, macroWarningCount: number): WatchlistVerdict {
  const thesisNegative = health !== 'Intact';
  const macroNegative = macroWarningCount > 0;
  const negativeCount = [thesisNegative, overbought, macroNegative].filter(Boolean).length;

  if (negativeCount === 3) return { emoji: '🔴', text: 'Strong exit signal — thesis broken, overbought, macro headwind' };
  if (negativeCount === 2) return { emoji: '🟡', text: 'Consider trimming — multiple exit signals present' };
  if (negativeCount === 1) return { emoji: '🟡', text: 'Monitor closely — one exit signal active' };
  return { emoji: '🟢', text: 'Hold — thesis intact, technicals reasonable, macro supportive' };
}
