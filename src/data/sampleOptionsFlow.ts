import type { OptionActivity } from '@/types';

// Clearly-labeled sample data (see `sample: true` below, surfaced in the UI) — no free API
// provides real options-chain data for European exchanges (verified: CBOE's free delayed-quotes
// endpoint, the one real source this tab uses for US tickers, is US-listed only). Rather than
// show an empty EU section, these demonstrate the concept with realistic figures. Values are
// illustrative, not live quotes — days-to-expiry below is computed from `expiry` at render time,
// so these stay "a few weeks/months out" rather than visibly aging into the past.
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const SAMPLE_EU_OPTIONS_FLOW: OptionActivity[] = [
  {
    ticker: 'ASML',
    companyName: 'ASML Holding',
    type: 'CALL',
    strike: 850,
    expiry: daysFromNow(21),
    volume: 4200,
    openInterest: 380,
    lastPrice: 18.4,
    iv: 0.34,
    currentPrice: 790,
    sample: true,
  },
  {
    ticker: 'ITX',
    companyName: 'Inditex',
    type: 'PUT',
    strike: 48,
    expiry: daysFromNow(35),
    volume: 2600,
    openInterest: 410,
    lastPrice: 1.85,
    iv: 0.29,
    currentPrice: 53,
    sample: true,
  },
  {
    ticker: 'SAP',
    companyName: 'SAP SE',
    type: 'CALL',
    strike: 210,
    expiry: daysFromNow(75),
    volume: 1800,
    openInterest: 95,
    lastPrice: 4.2,
    iv: 0.31,
    currentPrice: 184,
    sample: true,
  },
  {
    ticker: 'DTE',
    companyName: 'Deutsche Telekom',
    type: 'PUT',
    strike: 26,
    expiry: daysFromNow(14),
    volume: 3100,
    openInterest: 890,
    lastPrice: 0.42,
    iv: 0.26,
    currentPrice: 28.7,
    sample: true,
  },
  {
    ticker: 'TTE',
    companyName: 'TotalEnergies SE',
    type: 'CALL',
    strike: 85,
    expiry: daysFromNow(52),
    volume: 1450,
    openInterest: 610,
    lastPrice: 2.1,
    iv: 0.24,
    currentPrice: 79,
    sample: true,
  },
];
