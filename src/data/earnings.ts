import type { EarningsDate } from '@/types';

// Reference date: 2026-07-29
export const EARNINGS_DATES: EarningsDate[] = [
  { ticker: 'ASML', nextEarnings: '2026-08-12', source: 'sample' },
  { ticker: 'SAP', nextEarnings: '2026-07-30', source: 'sample' },
  { ticker: 'NOVO', nextEarnings: '2026-08-06', source: 'sample' },
  { ticker: 'SHEL', nextEarnings: '2026-08-01', source: 'sample' },
  { ticker: 'MC', nextEarnings: '2026-08-25', source: 'sample' },
  { ticker: 'BNP', nextEarnings: '2026-09-15', source: 'sample' },
  { ticker: 'NVS', nextEarnings: '2026-08-18', source: 'sample' },
  { ticker: 'AIR', nextEarnings: '2026-07-31', source: 'sample' },
  { ticker: 'NESN', nextEarnings: '2026-08-20', source: 'sample' },
  { ticker: 'ROG', nextEarnings: '2026-07-30', source: 'sample' },
  { ticker: 'TTE', nextEarnings: '2026-08-08', source: 'sample' },
  { ticker: 'DBK', nextEarnings: '2026-09-12', source: 'sample' },
  { ticker: 'OR', nextEarnings: '2026-08-28', source: 'sample' },
  { ticker: 'NVDA', nextEarnings: '2026-08-20', source: 'sample' },
  { ticker: 'AAPL', nextEarnings: '2026-08-01', source: 'sample' },
  { ticker: 'JPM', nextEarnings: '2026-10-14', source: 'sample' },
];

const EARNINGS_MAP: Record<string, EarningsDate> = Object.fromEntries(
  EARNINGS_DATES.map((e) => [e.ticker, e]),
);

export function getEarningsDate(ticker: string): EarningsDate | null {
  return EARNINGS_MAP[ticker] ?? null;
}

export function daysUntilEarnings(nextEarnings: string, from: string = '2026-07-29'): number {
  const target = new Date(nextEarnings);
  const start = new Date(from);
  return Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}
