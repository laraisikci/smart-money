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

export type InstitutionalAction = 'new' | 'increased' | 'decreased' | 'exited';

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

export interface EuropeanRegulatorLink {
  country: string;
  regulator: string;
  description: string;
  url: string;
}

export interface NewsHeadline {
  ticker: string;
  title: string;
  url: string;
  publishedAt: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
}

export interface TickerNews {
  ticker: string;
  headlines: NewsHeadline[];
}

export type MacroIndicatorId = 'ecbRate' | 'eurUsd' | 'inflation' | 'brent' | 'vix' | 'stoxx50';

export interface MacroIndicator {
  id: MacroIndicatorId;
  label: string;
  value: number;
  unit: string;
  previousValue: number;
  change: number;
  changePercent: number | null;
  // Whether the observed change direction is good for equity markets in general — null when
  // roughly flat/unchanged, i.e. no directional read. Individual sectors can still read the same
  // move differently (see the frontend's sector rotation logic); this is the broad-market take.
  goodForMarkets: boolean | null;
  interpretation: string;
  asOf: string;
  source: string;
}

export interface MacroResponse {
  data: MacroIndicator[];
  generatedAt: string;
  unavailable: string[];
}

export interface AnalystRating {
  recommendationMean: number;
  recommendationKey: string;
  numberOfAnalysts: number;
  targetMeanPrice: number | null;
}

export interface TechnicalIndicators {
  ticker: string;
  price: number;
  sma20: number | null;
  sma50: number | null;
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
