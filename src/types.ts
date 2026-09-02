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

export type SignalType = 'insider' | 'institution' | 'polymarket' | 'news';

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

export type Sentiment = 'Positive' | 'Negative' | 'Neutral';

export interface NewsHeadline {
  ticker: string;
  title: string;
  url: string;
  publishedAt: string;
  sentiment: Sentiment;
}

export interface TickerNews {
  ticker: string;
  headlines: NewsHeadline[];
}

export interface AnalystRecommendationDistribution {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface AnalystRating {
  recommendationMean: number;
  recommendationKey: string;
  numberOfAnalysts: number;
  targetMeanPrice: number | null;
  distribution: AnalystRecommendationDistribution | null;
}

export interface TechnicalIndicators {
  ticker: string;
  price: number;
  sma20: number | null;
  sma50: number | null;
  sma125: number | null;
  sma200: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi14: number | null;
  stochK: number | null;
  stochD: number | null;
  analyst: AnalystRating | null;
  asOf: string;
}

export type MacroIndicatorId =
  | 'ecbRate'
  | 'eurUsd'
  | 'inflation'
  | 'brent'
  | 'vix'
  | 'stoxx50'
  | 'fearGreed'
  | 'putCallRatio';

export interface MacroIndicator {
  id: MacroIndicatorId;
  label: string;
  value: number;
  unit: string;
  previousValue: number;
  change: number;
  changePercent: number | null;
  goodForMarkets: boolean | null;
  interpretation: string;
  asOf: string;
  source: string;
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

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  market: 'EU' | 'US';
  currency: Currency;
  sector: Sector;
  tracked: boolean;
}

// What's actually needed to request or save an analysis — SearchResult satisfies this, but so
// does a WatchlistEntry or a ConvictionResult, without callers having to fake the extra fields.
export type AnalyzeTarget = Pick<SearchResult, 'symbol' | 'name' | 'market' | 'currency' | 'sector'>;

export interface AnalyzeResponse {
  ticker: string;
  name: string;
  market: 'EU' | 'US';
  currency: Currency;
  sector: Sector;
  insiders: InsiderTrade[];
  institutions: InstitutionalPosition[];
  news: NewsHeadline[];
  technicals: TechnicalIndicators | null;
  insidersFilerFound: boolean;
  generatedAt: string;
}

export type InstitutionalStance = 'increasing' | 'decreasing' | 'neutral';
export type SnapshotSentiment = 'positive' | 'neutral' | 'negative';
export type SmaPosition = 'above' | 'below';

// Signal readout captured at watchlist add-time (and recomputed live on every Watchlist tab
// load) — the pair of these is what the Signal Decay tracker diffs against to decide whether the
// original thesis still holds. Every field is nullable/neutral-able because not every ticker has
// full technical history (e.g. a newly-tracked stock without 200 days of prices yet).
export interface WatchlistSnapshot {
  convictionScore: number;
  rsi: number | null;
  stochK: number | null;
  vsSma50: SmaPosition | null;
  vsSma200: SmaPosition | null;
  institutionalStance: InstitutionalStance;
  newsSentiment: SnapshotSentiment;
}

export interface WatchlistEntry {
  symbol: string;
  name: string;
  market: 'EU' | 'US';
  currency: Currency;
  sector: Sector;
  addedAt: string;
  snapshot: WatchlistSnapshot;
}
