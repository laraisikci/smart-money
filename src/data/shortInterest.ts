import type { ShortInterest } from '@/types';

export const SHORT_INTEREST: ShortInterest[] = [
  { ticker: 'ASML', shortInterestPct: 2.1, float: 395_000_000, daysToCover: 3.2, source: 'sample' },
  { ticker: 'SAP', shortInterestPct: 4.8, float: 1_180_000_000, daysToCover: 5.1, source: 'sample' },
  { ticker: 'NOVO', shortInterestPct: 3.5, float: 2_200_000_000, daysToCover: 2.8, source: 'sample' },
  { ticker: 'SHEL', shortInterestPct: 6.2, float: 6_400_000_000, daysToCover: 7.4, source: 'sample' },
  { ticker: 'MC', shortInterestPct: 8.5, float: 500_000_000, daysToCover: 9.1, source: 'sample' },
  { ticker: 'BNP', shortInterestPct: 5.8, float: 2_500_000_000, daysToCover: 6.3, source: 'sample' },
  { ticker: 'NVS', shortInterestPct: 1.9, float: 2_100_000_000, daysToCover: 2.1, source: 'sample' },
  { ticker: 'AIR', shortInterestPct: 7.3, float: 800_000_000, daysToCover: 8.0, source: 'sample' },
  { ticker: 'NESN', shortInterestPct: 2.5, float: 2_700_000_000, daysToCover: 3.5, source: 'sample' },
  { ticker: 'ROG', shortInterestPct: 3.1, float: 650_000_000, daysToCover: 3.9, source: 'sample' },
  { ticker: 'TTE', shortInterestPct: 4.2, float: 2_600_000_000, daysToCover: 4.8, source: 'sample' },
  { ticker: 'DBK', shortInterestPct: 11.4, float: 2_100_000_000, daysToCover: 12.6, source: 'sample' },
  { ticker: 'OR', shortInterestPct: 5.5, float: 530_000_000, daysToCover: 6.0, source: 'sample' },
  { ticker: 'NVDA', shortInterestPct: 1.2, float: 24_000_000_000, daysToCover: 1.5, source: 'sample' },
  { ticker: 'AAPL', shortInterestPct: 0.8, float: 15_000_000_000, daysToCover: 1.1, source: 'sample' },
  { ticker: 'JPM', shortInterestPct: 1.5, float: 2_800_000_000, daysToCover: 2.3, source: 'sample' },
  { ticker: 'ENEL', shortInterestPct: 6.8, float: 3_200_000_000, daysToCover: 7.2, source: 'sample' },
  { ticker: 'ORX', shortInterestPct: 9.2, float: 410_000_000, daysToCover: 10.1, source: 'sample' },
  { ticker: 'INGA', shortInterestPct: 4.5, float: 3_900_000_000, daysToCover: 5.0, source: 'sample' },
  { ticker: 'HSBA', shortInterestPct: 5.1, float: 17_000_000_000, daysToCover: 5.5, source: 'sample' },
  { ticker: 'SAN', shortInterestPct: 3.8, float: 1_260_000_000, daysToCover: 4.2, source: 'sample' },
  { ticker: 'ABI', shortInterestPct: 4.1, float: 2_000_000_000, daysToCover: 4.6, source: 'sample' },
  { ticker: 'BMW', shortInterestPct: 7.8, float: 600_000_000, daysToCover: 8.5, source: 'sample' },
  { ticker: 'VOW3', shortInterestPct: 10.2, float: 300_000_000, daysToCover: 11.0, source: 'sample' },
  { ticker: 'BAS', shortInterestPct: 5.3, float: 900_000_000, daysToCover: 5.8, source: 'sample' },
  { ticker: 'AI', shortInterestPct: 2.7, float: 480_000_000, daysToCover: 3.0, source: 'sample' },
  { ticker: 'XOM', shortInterestPct: 3.4, float: 4_400_000_000, daysToCover: 3.8, source: 'sample' },
  { ticker: 'JNJ', shortInterestPct: 1.1, float: 2_400_000_000, daysToCover: 1.4, source: 'sample' },
  { ticker: 'AMZN', shortInterestPct: 0.9, float: 10_000_000_000, daysToCover: 1.2, source: 'sample' },
  { ticker: 'CAT', shortInterestPct: 2.9, float: 520_000_000, daysToCover: 3.3, source: 'sample' },
  { ticker: 'MSFT', shortInterestPct: 1.0, float: 7_400_000_000, daysToCover: 1.3, source: 'sample' },
  { ticker: 'SOPA', shortInterestPct: 6.5, float: 120_000_000, daysToCover: 7.0, source: 'sample' },
  { ticker: 'LOGI', shortInterestPct: 4.0, float: 160_000_000, daysToCover: 4.5, source: 'sample' },
];

const SI_MAP: Record<string, ShortInterest> = Object.fromEntries(
  SHORT_INTEREST.map((s) => [s.ticker, s]),
);

export function getShortInterest(ticker: string): ShortInterest | null {
  return SI_MAP[ticker] ?? null;
}

export function shortInterestLevel(pct: number): {
  label: string;
  color: string;
  bg: string;
} {
  if (pct < 5) return { label: 'Low', color: 'text-bull-400', bg: 'bg-bull-500/15 border-bull-500/30' };
  if (pct <= 15) return { label: 'Medium', color: 'text-warn-400', bg: 'bg-warn-500/15 border-warn-500/30' };
  return { label: 'High', color: 'text-bear-400', bg: 'bg-bear-500/15 border-bear-500/30' };
}
