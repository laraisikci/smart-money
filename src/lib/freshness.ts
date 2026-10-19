export type FreshnessLevel = 'fresh' | 'amber' | 'red';

const DAY_MS = 86_400_000;

export function ageDays(isoOrDate: string | Date, now = Date.now()): number {
  const t = typeof isoOrDate === 'string' ? new Date(isoOrDate).getTime() : isoOrDate.getTime();
  return Math.max(0, (now - t) / DAY_MS);
}

// Human age, coarse on purpose: "5 min", "3 hours", "2 days", "3 weeks", "2 months".
export function ageLabel(isoOrDate: string | Date, now = Date.now()): string {
  const days = ageDays(isoOrDate, now);
  const mins = days * 24 * 60;
  if (mins < 60) return `${Math.max(1, Math.round(mins))} min`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hour${Math.round(mins / 60) === 1 ? '' : 's'}`;
  if (days < 14) return `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.4);
  return `${months} month${months === 1 ? '' : 's'}`;
}

export function levelFor(days: number, amberDays: number, redDays: number): FreshnessLevel {
  if (days > redDays) return 'red';
  if (days > amberDays) return 'amber';
  return 'fresh';
}

export const LEVEL_CLASS: Record<FreshnessLevel, string> = {
  fresh: 'text-ink-500 bg-ink-800/60 border-ink-700/60',
  amber: 'text-warn-300 bg-warn-500/10 border-warn-500/30',
  red: 'text-bear-300 bg-bear-500/10 border-bear-500/30',
};

// "Q2 2026" -> the last day of that quarter (13F data describes holdings *as of* quarter end,
// which is the date its age should be measured from — not when the filing happened to land).
export function quarterEnd(quarter: string): Date | null {
  const m = /Q([1-4])\s+(\d{4})/i.exec(quarter);
  if (!m) return null;
  const q = Number(m[1]);
  const year = Number(m[2]);
  return new Date(Date.UTC(year, q * 3, 0)); // day 0 of the next quarter's first month = last day of this one
}

export const THIRTEEN_F_AMBER_DAYS = 42; // 6 weeks
export const THIRTEEN_F_RED_DAYS = 90; // 3 months
