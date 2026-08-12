import type { MacroIndicator, MacroIndicatorId, Sector } from '@/types';

export type SectorPulseSignal = 'Tailwind' | 'Headwind' | 'Neutral';

export interface SectorPulse {
  sector: Sector;
  label: string;
  signal: SectorPulseSignal;
  reason: string;
}

// The 8 sectors requested for the heatmap, mapped to this app's existing Sector type (used
// elsewhere for conviction scoring) so "Macro-Aligned Picks" can filter the tracked universe by
// the same field without a second sector taxonomy.
const PULSE_SECTORS: { sector: Sector; label: string }[] = [
  { sector: 'Tech', label: 'Technology' },
  { sector: 'Financials', label: 'Financials' },
  { sector: 'Energy', label: 'Energy' },
  { sector: 'Healthcare', label: 'Healthcare' },
  { sector: 'Industrials', label: 'Industrials' },
  { sector: 'Consumer', label: 'Consumer Staples' },
  { sector: 'RealEstate', label: 'Real Estate' },
  { sector: 'Utilities', label: 'Utilities' },
];

// Threshold for the VIX matches the wording already shown on the macro card itself
// (server/src/routes/macro.ts: fetchVix) so the heatmap doesn't disagree with the card above it.
const VIX_HIGH = 25;
const VIX_LOW = 15;

interface Contribution {
  weight: number;
  reason: string;
}

function push(arr: Contribution[], active: boolean, weight: number, reason: string) {
  if (active) arr.push({ weight, reason });
}

export function computeSectorPulse(indicators: MacroIndicator[]): SectorPulse[] {
  const byId = new Map<MacroIndicatorId, MacroIndicator>(indicators.map((i) => [i.id, i]));
  const ecbRate = byId.get('ecbRate');
  const brent = byId.get('brent');
  const eurUsd = byId.get('eurUsd');
  const vix = byId.get('vix');

  const ratesRising = !!ecbRate && ecbRate.change > 0;
  const ratesFalling = !!ecbRate && ecbRate.change < 0;
  const oilRising = !!brent && brent.change > 0;
  const oilFalling = !!brent && brent.change < 0;
  const eurWeak = !!eurUsd && eurUsd.change < 0;
  const eurStrong = !!eurUsd && eurUsd.change > 0;
  const highVix = !!vix && vix.value >= VIX_HIGH;
  const lowVix = !!vix && vix.value <= VIX_LOW;

  const contributionsBySector: Record<Sector, Contribution[]> = {
    Tech: [],
    Energy: [],
    Financials: [],
    Healthcare: [],
    Consumer: [],
    Industrials: [],
    Materials: [],
    Telecom: [],
    Utilities: [],
    RealEstate: [],
  };

  push(contributionsBySector.Financials, ratesRising, 2, 'Rising rates boost bank margins');
  push(contributionsBySector.Financials, ratesFalling, -1, 'Falling rates compress net interest margins');
  push(contributionsBySector.Financials, highVix, -1, 'Market stress raises credit-risk concerns for banks');

  push(contributionsBySector.RealEstate, ratesRising, -2, 'Higher rates raise borrowing costs for REITs');
  push(contributionsBySector.RealEstate, ratesFalling, 2, 'Lower rates cut REIT financing costs');

  push(contributionsBySector.Utilities, ratesRising, -2, 'Rate-sensitive dividend stocks lose appeal as rates rise');
  push(contributionsBySector.Utilities, ratesFalling, 2, 'Falling rates boost yield-sensitive utilities');
  push(contributionsBySector.Utilities, highVix, 1, 'Defensive, stable-dividend utilities attract risk-off flows');

  push(contributionsBySector.Energy, oilRising, 2, 'Higher crude prices lift energy producer margins');
  push(contributionsBySector.Energy, oilFalling, -2, 'Falling crude prices pressure energy producer margins');

  push(contributionsBySector.Consumer, oilRising, -1, 'Higher fuel and input costs squeeze margins');
  push(contributionsBySector.Consumer, oilFalling, 1, 'Lower fuel costs ease cost pressure on consumer goods');
  push(contributionsBySector.Consumer, highVix, 2, 'Staples demand holds steady when volatility rises');

  push(contributionsBySector.Tech, eurWeak, 2, 'Weaker euro makes euro-priced exports more competitive');
  push(contributionsBySector.Tech, eurStrong, -1, 'Stronger euro makes exports costlier for foreign buyers');
  push(contributionsBySector.Tech, highVix, -1, 'High-beta growth stocks sell off first in risk-off moves');

  push(contributionsBySector.Industrials, eurWeak, 2, 'Weaker euro boosts overseas revenue when converted back to EUR');
  push(contributionsBySector.Industrials, eurStrong, -1, 'Stronger euro weighs on overseas earnings translation');
  push(contributionsBySector.Industrials, oilRising, -1, 'Higher fuel costs raise transport and input costs');

  push(contributionsBySector.Healthcare, highVix, 2, 'Defensive earnings attract investors in risk-off conditions');
  push(contributionsBySector.Healthcare, lowVix, -1, 'Risk-on markets favor cyclicals over defensives');

  return PULSE_SECTORS.map(({ sector, label }) => {
    const contributions = contributionsBySector[sector];
    const score = contributions.reduce((sum, c) => sum + c.weight, 0);
    const signal: SectorPulseSignal = score > 0 ? 'Tailwind' : score < 0 ? 'Headwind' : 'Neutral';
    const strongest = contributions.reduce<Contribution | null>(
      (best, c) => (best === null || Math.abs(c.weight) > Math.abs(best.weight) ? c : best),
      null,
    );
    return {
      sector,
      label,
      signal,
      reason: strongest?.reason ?? 'No strong macro signal for this sector right now',
    };
  });
}
