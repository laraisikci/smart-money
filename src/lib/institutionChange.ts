import type { InstitutionalPosition } from '@/types';
import { formatCurrency } from '@/lib/format';

// A percentage off a near-zero base is meaningless (+275,718% on a position that grew from a
// rounding error), so it's only shown when the prior position was at least this large.
export const MIN_PRIOR_FOR_PCT = 1_000_000;
export const PCT_DISPLAY_CAP = 999;

export interface InstitutionChange {
  dollar: number; // signed dollar size of the change
  pct: number | null; // null = hidden (prior position too small, or brand new)
  pctCapped: boolean;
  isNew: boolean;
  nearNew: boolean; // prior position under $1M, so % hidden
}

export function institutionChange(p: InstitutionalPosition): InstitutionChange {
  // Prefer the server's figures; derive from marketValue + pctChange for a backend that predates them.
  let prior = p.priorValue;
  let dollar = p.valueChange;
  if (prior === undefined || dollar === undefined) {
    if (p.action === 'new') {
      prior = 0;
      dollar = p.marketValue;
    } else if (p.action === 'exited') {
      prior = 0; // unknown without the server field
      dollar = 0;
    } else {
      prior = p.marketValue / (1 + p.pctChange / 100);
      dollar = p.marketValue - prior;
    }
  }
  const isNew = p.action === 'new' || prior === 0;
  const nearNew = !isNew && prior < MIN_PRIOR_FOR_PCT;
  if (isNew || nearNew) return { dollar, pct: null, pctCapped: false, isNew, nearNew };
  const capped = Math.abs(p.pctChange) > PCT_DISPLAY_CAP;
  return { dollar, pct: capped ? Math.sign(p.pctChange) * PCT_DISPLAY_CAP : p.pctChange, pctCapped: capped, isNew, nearNew };
}

export function formatSignedDollar(n: number): string {
  return `${n >= 0 ? '+' : '-'}${formatCurrency(Math.abs(n))}`;
}

// "+$45M (+12%)" — dollars always, percentage only when it means something; never percentage alone.
export function formatChange(c: InstitutionChange): string {
  const dollar = formatSignedDollar(c.dollar);
  if (c.pct === null) return dollar;
  const pct = `${c.pct > 0 ? '+' : ''}${c.pct.toFixed(c.pctCapped ? 0 : 1)}%`;
  return `${dollar} (${c.pctCapped ? pct.replace(/%$/, '%+') : pct})`;
}

export function changeNote(c: InstitutionChange): string | null {
  if (c.isNew) return 'New position';
  if (c.nearNew || c.pctCapped) return 'New or near-new position';
  return null;
}
