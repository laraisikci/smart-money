export type Sector =
  | 'Tech'
  | 'Energy'
  | 'Financials'
  | 'Healthcare'
  | 'Consumer'
  | 'Industrials'
  | 'Materials'
  | 'Telecom'
  | 'Utilities'
  | 'RealEstate';

  export const SECTORS: Sector[] = [
    'Tech',
    'Energy',
    'Financials',
    'Healthcare',
    'Consumer',
    'Industrials',
    'Materials',
    'Telecom',
    'Utilities',
    'RealEstate',
  ];

export type SignalType = 'insider' | 'institution' | 'polymarket';

// Currency of each ticker's primary listing exchange. Nearly all Eurozone constituents (DAX,
// CAC 40, IBEX 35, AEX, and most of EuroStoxx 50) trade in EUR; the rest reflect each company's
// actual primary listing — e.g. Shell and Unilever both moved their primary listing to London
// (GBP) even though they're still dual-listed on Euronext Amsterdam.
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CHF' | 'DKK' | 'SEK' | 'NOK';

export interface TickerMeta {
  symbol: string;
  name: string;
  sector: Sector;
  market: 'EU' | 'US';
  currency: Currency;
}

export interface InsiderTrade {
  id: string;
  ticker: string;
  insiderName: string;
  insiderTitle: string;
  transactionType: 'BUY' | 'SELL';
  shares: number;
  price: number;
  value: number;
  filingDate: string;
  market: 'EU' | 'US';
}

export type InstitutionalAction =
  | 'new'
  | 'increased'
  | 'decreased'
  | 'exited';

export interface InstitutionalPosition {
  id: string;
  fundName: string;
  fundSlug: string;
  ticker: string;
  companyName: string;
  action: InstitutionalAction;
  shares: number;
  marketValue: number;
  pctChange: number;
  filingDate: string;
  quarter: string;
}

export interface EuropeanRegulatorLink {
  country: string;
  regulator: string;
  description: string;
  url: string;
}

export interface OfficialSourceLink {
  label: string;
  url: string;
}

export interface PolymarketMarket {
  id: string;
  question: string;
  category: string;
  yesPrice: number;
  volume: number;
  liquidity: number;
  endDate: string;
  relatedTickers: string[];
}

export interface ConvictionSignal {
  type: SignalType;
  score: number;
  detail: string;
}

export interface ConvictionResult {
  ticker: string;
  name: string;
  sector: Sector;
  market: 'EU' | 'US';
  currency: Currency;
  totalScore: number;
  signals: ConvictionSignal[];
  signalsActive: SignalType[];
}

export interface EarningsDate {
  ticker: string;
  nextEarnings: string;
  source: 'sample';
}

export interface ShortInterest {
  ticker: string;
  shortInterestPct: number;
  float: number;
  daysToCover: number;
  source: 'sample';
}
