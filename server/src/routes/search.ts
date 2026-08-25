import { Router } from 'express';
import { TICKERS } from '../data/tickers.js';
import type { Sector, Currency } from '../data/tickers.js';
import { fetchYahooJson } from '../lib/newsClient.js';
import { normalize, buildIssuerMatcher } from '../lib/nameMatch.js';
import { resolveCikByQuery } from '../lib/cikResolver.js';
import { fetchInsiderTradesForTicker } from '../lib/insiderFetch.js';
import { fetchFundPositionsForMatcher } from '../lib/institutionFetch.js';
import { fetchNewsForYahooSymbol } from '../lib/newsFetch.js';
import { getTechnicals } from '../lib/technicalsFetch.js';
import { FUNDS } from '../data/funds.js';
import type { InsiderTrade, InstitutionalPosition, NewsHeadline, TechnicalIndicators } from '../types.js';

// Same preferred-exchange logic as yahooSymbolResolver.ts (EU primaries Yahoo actually surfaces
// reliably), plus the major US exchanges, since autocomplete needs to cover both. Restricting to
// this set — rather than accepting every exchange Yahoo returns — is what keeps results to real,
// recognizable primary/major listings instead of obscure cross-listings and cross-currency ETPs.
const EU_EXCHANGE_CURRENCY: Record<string, Currency> = {
  PAR: 'EUR',
  GER: 'EUR',
  FRA: 'EUR',
  ETR: 'EUR',
  AMS: 'EUR',
  MCE: 'EUR',
  MIL: 'EUR',
  BRU: 'EUR',
  LSE: 'GBP',
  LON: 'GBP',
  SWX: 'CHF',
  VTX: 'CHF',
  EBS: 'CHF',
  CPH: 'DKK',
  STO: 'SEK', // Stockholm — verified directly: Volvo's only clean listings are STO + US OTC
  // (Pink Sheets, deliberately excluded below), so without this a Swedish search could return
  // nothing at all even though this app's own Currency type already has SEK for exactly this.
  OSL: 'NOK', // Oslo — same reasoning; Equinor happens to have a NYQ ADR so was findable either
  // way, but its Oslo primary wasn't, and not every Norwegian company has a US ADR to fall back on.
};
const US_EXCHANGES = new Set(['NMS', 'NYQ', 'NGM', 'NCM', 'BATS', 'PCX', 'ASE']);

export interface SearchResult {
  symbol: string; // ready-to-use Yahoo symbol
  name: string;
  exchange: string;
  market: 'EU' | 'US';
  currency: Currency;
  sector: Sector;
  tracked: boolean; // already in the pre-tracked universe, shown for context only
}

interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
  sectorDisp?: string;
}
interface YahooSearchResponse {
  quotes?: YahooSearchQuote[];
}

// Yahoo's own sector taxonomy (roughly GICS) mapped onto this app's existing Sector union, so an
// ad-hoc search result gets a real classification instead of a guessed one. Falls back to 'Tech'
// only when Yahoo's search result carries no sector at all (happens for some minor listings) —
// same last-resort default getTickerMeta() already uses for any symbol it doesn't recognize.
const YAHOO_SECTOR_MAP: Record<string, Sector> = {
  Technology: 'Tech',
  'Financial Services': 'Financials',
  Energy: 'Energy',
  Healthcare: 'Healthcare',
  Industrials: 'Industrials',
  'Consumer Defensive': 'Consumer',
  'Consumer Cyclical': 'Consumer',
  'Real Estate': 'RealEstate',
  Utilities: 'Utilities',
  'Basic Materials': 'Materials',
  'Communication Services': 'Telecom',
};
function mapSector(sectorDisp: string | undefined): Sector {
  return (sectorDisp && YAHOO_SECTOR_MAP[sectorDisp]) || 'Tech';
}

function searchTracked(query: string, limit: number): SearchResult[] {
  const q = query.toUpperCase();
  const nq = normalize(query);
  if (!nq) return [];
  return TICKERS.filter((t) => t.symbol.toUpperCase().startsWith(q) || normalize(t.name).includes(nq))
    .slice(0, limit)
    .map((t) => ({
      symbol: t.symbol,
      name: t.name,
      exchange: t.market,
      market: t.market,
      currency: t.currency,
      sector: t.sector,
      tracked: true,
    }));
}

async function searchYahoo(query: string, limit: number): Promise<SearchResult[]> {
  const data = await fetchYahooJson<YahooSearchResponse>(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`,
    60 * 60_000, // company search results barely change hour to hour
  );
  const results: SearchResult[] = [];
  for (const q of data.quotes ?? []) {
    if (q.quoteType !== 'EQUITY' || !q.symbol || !q.exchange) continue;
    const isUS = US_EXCHANGES.has(q.exchange);
    const currency = isUS ? 'USD' : EU_EXCHANGE_CURRENCY[q.exchange];
    if (!currency) continue; // not one of the exchanges we recognize — skip rather than guess
    results.push({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchange,
      market: isUS ? 'US' : 'EU',
      currency,
      sector: mapSector(q.sectorDisp),
      tracked: false,
    });
    if (results.length >= limit) break;
  }
  return results;
}

interface AnalyzeResponse {
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

async function fetchAdhocInsiders(
  displayTicker: string,
  market: 'EU' | 'US',
  name: string,
): Promise<{ trades: InsiderTrade[]; filerFound: boolean }> {
  // US ad-hoc tickers: the Yahoo symbol already is the SEC ticker. EU ones essentially never are
  // (SEC lists foreign issuers, if at all, under their own ADR ticker) — resolve by company name
  // instead, same as the bulk universe does via EU_TO_SEC_TICKER, but live rather than curated.
  const cik = await resolveCikByQuery(market === 'US' ? displayTicker.split('.')[0] : name);
  if (!cik) return { trades: [], filerFound: false };
  try {
    const trades = await fetchInsiderTradesForTicker(displayTicker, market, cik.cikPadded);
    return { trades, filerFound: true };
  } catch {
    return { trades: [], filerFound: true };
  }
}

async function fetchAdhocInstitutions(displayTicker: string, name: string): Promise<InstitutionalPosition[]> {
  // Only ever reflects the same 10 funds tracked elsewhere in this app — an honest scope limit,
  // not a bug: there's no way to search "all 13F filers" for one company without a paid dataset.
  const matcher = buildIssuerMatcher([{ symbol: displayTicker, name }]);
  const perFund = await Promise.all(
    FUNDS.map((fund) => fetchFundPositionsForMatcher(fund, matcher).catch(() => [] as InstitutionalPosition[])),
  );
  return perFund.flat();
}

const ANALYZE_CACHE_TTL_MS = 60 * 60_000; // 1h — shorter than the bulk routes since ad-hoc lookups are less predictable
const analyzeCache = new Map<string, { expires: number; value: AnalyzeResponse }>();
const analyzeInFlight = new Map<string, Promise<AnalyzeResponse>>();

async function computeAnalysis(
  yahooSymbol: string,
  name: string,
  market: 'EU' | 'US',
  currency: Currency,
  sector: Sector,
): Promise<AnalyzeResponse> {
  // allSettled, not all — these hit four independent external sources (Yahoo chart+analyst, Yahoo
  // RSS, SEC EDGAR Form 4, SEC EDGAR 13F x10 funds), and a slow or failing one (each already
  // guarded by its own 4s timeout, see fetchTimeout.ts) must never take the other three down with
  // it or block the response waiting on a source that's never coming back.
  const [technicalsResult, newsResult, insidersResult, institutionsResult] = await Promise.allSettled([
    getTechnicals(yahooSymbol, yahooSymbol),
    fetchNewsForYahooSymbol(yahooSymbol, yahooSymbol),
    fetchAdhocInsiders(yahooSymbol, market, name),
    fetchAdhocInstitutions(yahooSymbol, name),
  ]);

  const technicals = technicalsResult.status === 'fulfilled' ? technicalsResult.value : null;
  const news = newsResult.status === 'fulfilled' ? newsResult.value : [];
  const insiders =
    insidersResult.status === 'fulfilled' ? insidersResult.value : { trades: [], filerFound: false };
  const institutions = institutionsResult.status === 'fulfilled' ? institutionsResult.value : [];

  return {
    ticker: yahooSymbol,
    name,
    market,
    currency,
    sector,
    insiders: insiders.trades,
    institutions,
    news,
    technicals,
    insidersFilerFound: insiders.filerFound,
    generatedAt: new Date().toISOString(),
  };
}

export function searchRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json({ data: [] });

    // searchTracked is a local, synchronous array scan — it cannot fail. searchYahoo hits an
    // external API on a 4s timeout and can. Previously a single slow/failed Yahoo call (a bad
    // moment, a transient timeout) sank the *entire* response with a 502 — including the tracked-
    // universe match that had already succeeded — which is exactly what "search sometimes can't
    // find stocks that are right there in the tracked list" looks like from the outside. Yahoo
    // failing now degrades to "just the tracked match" instead of "nothing at all".
    const tracked = searchTracked(q, 5);
    const trackedSymbols = new Set(tracked.map((r) => r.symbol));
    let yahoo: SearchResult[] = [];
    try {
      yahoo = await searchYahoo(q, 10);
    } catch {
      // swallow — tracked-universe results still go out below
    }
    const merged = [...tracked, ...yahoo.filter((r) => !trackedSymbols.has(r.symbol))].slice(0, 8);
    res.json({ data: merged });
  });

  router.get('/analyze/:symbol', async (req, res) => {
    const yahooSymbol = req.params.symbol.toUpperCase();
    const name = String(req.query.name ?? yahooSymbol);
    const market: 'EU' | 'US' = req.query.market === 'US' ? 'US' : 'EU';
    const currency = (String(req.query.currency ?? (market === 'US' ? 'USD' : 'EUR')) as Currency);
    const sector = (String(req.query.sector ?? 'Tech') as Sector);

    const cached = analyzeCache.get(yahooSymbol);
    if (cached && cached.expires > Date.now()) return res.json(cached.value);

    try {
      let pending = analyzeInFlight.get(yahooSymbol);
      if (!pending) {
        pending = computeAnalysis(yahooSymbol, name, market, currency, sector).finally(() => {
          analyzeInFlight.delete(yahooSymbol);
        });
        analyzeInFlight.set(yahooSymbol, pending);
      }
      const value = await pending;
      analyzeCache.set(yahooSymbol, { expires: Date.now() + ANALYZE_CACHE_TTL_MS, value });
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to analyze ticker', detail: String(err) });
    }
  });

  return router;
}
