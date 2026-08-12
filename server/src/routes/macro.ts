import { Router } from 'express';
import { cachedFetchJson } from '../lib/cache.js';
import { fetchYahooJson } from '../lib/newsClient.js';
import type { MacroIndicator, MacroIndicatorId } from '../types.js';

const CACHE_TTL_MS = 60 * 60_000; // 1h, per spec

function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// ---- ECB SDMX-JSON (data-api.ecb.europa.eu) ----
//
// The ECB dataflow/series-key format the feature was originally specced against
// ("FM/B.U2.EUR.RT0.BB.R.1.EUR.2250.Z01.E") isn't a valid series — verified directly, the API's
// WAF returns a blanket "access blocked due to security concerns" 400 for it. The series below
// were checked directly against the live API and return real data:
//   - FM/D.U2.EUR.4F.KR.MRR_FR.LEV — ECB main refinancing operations fixed rate, the figure
//     financial media actually mean by "the ECB interest rate"
//   - ICP/M.U2.N.000000.4.ANR — HICP all-items, euro area, annual rate (Eurostat/ECB inflation)
const ECB_RATE_SERIES = 'FM/D.U2.EUR.4F.KR.MRR_FR.LEV';
const ECB_INFLATION_SERIES = 'ICP/M.U2.N.000000.4.ANR';

interface SdmxResponse {
  dataSets: { series: Record<string, { observations: Record<string, [number, ...unknown[]]> }> }[];
  structure: { dimensions: { observation: { values: { id: string }[] }[] } };
}

function parseSdmxSeries(data: SdmxResponse): { date: string; value: number }[] {
  const seriesMap = data.dataSets[0]?.series ?? {};
  const seriesKey = Object.keys(seriesMap)[0];
  if (!seriesKey) return [];
  const dates = data.structure.dimensions.observation[0]?.values ?? [];
  return Object.entries(seriesMap[seriesKey].observations)
    .map(([idx, obs]) => ({ date: dates[Number(idx)]?.id, value: obs[0] }))
    .filter((o): o is { date: string; value: number } => typeof o.date === 'string' && Number.isFinite(o.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchEcbSeries(seriesPath: string, lastN: number): Promise<{ date: string; value: number }[]> {
  const data = await cachedFetchJson<SdmxResponse>(
    `https://data-api.ecb.europa.eu/service/data/${seriesPath}?lastNObservations=${lastN}&format=jsondata`,
    CACHE_TTL_MS,
  );
  return parseSdmxSeries(data);
}

async function fetchEcbRate(): Promise<MacroIndicator> {
  // The policy rate only moves on ECB decision dates (roughly every 6-8 weeks) but the series
  // publishes a value every business day — comparing to yesterday would show "0 change" almost
  // always. Pulling ~90 days and diffing against the earliest point in that window instead
  // surfaces the last actual decision, not just today-vs-yesterday noise.
  const obs = await fetchEcbSeries(ECB_RATE_SERIES, 90);
  if (obs.length === 0) throw new Error('No ECB rate data');
  const latest = obs[obs.length - 1];
  const earliest = obs[0];
  const change = round(latest.value - earliest.value);
  return {
    id: 'ecbRate',
    label: 'ECB Interest Rate',
    value: latest.value,
    unit: '%',
    previousValue: earliest.value,
    change,
    changePercent: null,
    goodForMarkets: change === 0 ? null : change < 0,
    interpretation:
      change > 0
        ? 'ECB raised rates — headwind for equities, tailwind for bank margins'
        : change < 0
          ? 'ECB cut rates — tailwind for equities'
          : 'ECB holding rates steady — neutral for equities',
    asOf: latest.date,
    source: 'ECB (main refinancing rate)',
  };
}

async function fetchInflation(): Promise<MacroIndicator> {
  const obs = await fetchEcbSeries(ECB_INFLATION_SERIES, 2);
  if (obs.length < 2) throw new Error('No ECB inflation data');
  const previous = obs[obs.length - 2];
  const latest = obs[obs.length - 1];
  const change = round(latest.value - previous.value);
  return {
    id: 'inflation',
    label: 'Eurozone Inflation',
    value: latest.value,
    unit: '%',
    previousValue: previous.value,
    change,
    changePercent: null,
    goodForMarkets: change === 0 ? null : change < 0,
    interpretation:
      change > 0
        ? 'Inflation accelerating — raises pressure for further ECB tightening'
        : change < 0
          ? 'Inflation cooling — supports the case for rate cuts'
          : 'Inflation steady — no fresh signal for ECB policy',
    asOf: latest.date,
    source: 'ECB (HICP, annual rate)',
  };
}

// ---- Frankfurter (frankfurter.dev — frankfurter.app itself now 301s here) ----
async function fetchEurUsd(): Promise<MacroIndicator> {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const data = await cachedFetchJson<{ rates: Record<string, { USD: number }> }>(
    `https://api.frankfurter.dev/v1/${tenDaysAgo}..?base=EUR&symbols=USD`,
    CACHE_TTL_MS,
  );
  const entries = Object.entries(data.rates).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length < 2) throw new Error('No EUR/USD data');
  const [prevDate, prevRate] = entries[entries.length - 2];
  const [latestDate, latestRate] = entries[entries.length - 1];
  const change = round(latestRate.USD - prevRate.USD, 4);
  void prevDate;
  return {
    id: 'eurUsd',
    label: 'EUR/USD',
    value: latestRate.USD,
    unit: '',
    previousValue: prevRate.USD,
    change,
    changePercent: round((change / prevRate.USD) * 100, 2),
    // A weaker euro is a tailwind for the euro-area exporters that dominate the STOXX 50 —
    // their foreign revenue converts back to more euros — so EUR/USD falling reads as good for
    // this dashboard's market, not bad.
    goodForMarkets: change === 0 ? null : change < 0,
    interpretation:
      change > 0
        ? 'Euro strengthening — headwind for EU exporters'
        : change < 0
          ? 'Euro weakening — tailwind for EU exporters'
          : 'EUR/USD roughly flat',
    asOf: latestDate,
    source: 'Frankfurter (ECB reference rates)',
  };
}

// ---- Yahoo Finance chart endpoint (VIX, Euro Stoxx 50, Brent) ----
interface YahooChartResponse {
  chart: {
    result?: [
      {
        meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
        timestamp?: number[];
      },
    ];
  };
}

async function fetchYahooQuote(symbol: string): Promise<{ value: number; previousValue: number; asOf: string }> {
  const data = await fetchYahooJson<YahooChartResponse>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
    CACHE_TTL_MS,
  );
  const result = data.chart.result?.[0];
  const meta = result?.meta;
  if (!meta?.regularMarketPrice || !meta?.chartPreviousClose) {
    throw new Error(`No Yahoo chart data for ${symbol}`);
  }
  const lastTs = result?.timestamp?.[result.timestamp.length - 1];
  return {
    value: meta.regularMarketPrice,
    previousValue: meta.chartPreviousClose,
    asOf: lastTs ? new Date(lastTs * 1000).toISOString() : new Date().toISOString(),
  };
}

async function fetchBrent(): Promise<MacroIndicator> {
  const q = await fetchYahooQuote('BZ=F');
  const change = round(q.value - q.previousValue);
  const changePercent = round((change / q.previousValue) * 100, 2);
  return {
    id: 'brent',
    label: 'Brent Crude',
    value: round(q.value),
    unit: 'USD/bbl',
    previousValue: round(q.previousValue),
    change,
    changePercent,
    // Broad-market take: rising input costs are a headwind overall even though energy stocks
    // specifically benefit — the sector heatmap captures that upside separately.
    goodForMarkets: change === 0 ? null : change < 0,
    interpretation:
      change > 0
        ? 'Oil prices rising — tailwind for energy producers, cost pressure elsewhere'
        : change < 0
          ? 'Oil prices falling — relief for consumers and transport costs'
          : 'Oil prices roughly flat',
    asOf: q.asOf,
    source: 'Yahoo Finance (Brent futures, BZ=F)',
  };
}

async function fetchVix(): Promise<MacroIndicator> {
  const q = await fetchYahooQuote('^VIX');
  const change = round(q.value - q.previousValue);
  return {
    id: 'vix',
    label: 'VIX Fear Index',
    value: round(q.value),
    unit: '',
    previousValue: round(q.previousValue),
    change,
    changePercent: round((change / q.previousValue) * 100, 2),
    goodForMarkets: change === 0 ? null : change < 0,
    interpretation:
      q.value >= 25
        ? 'Elevated volatility — risk-off, defensive sectors favored'
        : q.value <= 15
          ? 'Low volatility — risk-on environment'
          : 'Moderate volatility — no strong risk signal',
    asOf: q.asOf,
    source: 'Yahoo Finance (^VIX)',
  };
}

async function fetchStoxx50(): Promise<MacroIndicator> {
  const q = await fetchYahooQuote('^STOXX50E');
  const change = round(q.value - q.previousValue);
  const changePercent = round((change / q.previousValue) * 100, 2);
  return {
    id: 'stoxx50',
    label: 'Euro Stoxx 50',
    value: round(q.value),
    unit: 'pts',
    previousValue: round(q.previousValue),
    change,
    changePercent,
    goodForMarkets: change === 0 ? null : change > 0,
    interpretation:
      change > 0
        ? 'European equities up on the day — risk-on sentiment'
        : change < 0
          ? 'European equities down on the day — risk-off sentiment'
          : 'European equities roughly flat',
    asOf: q.asOf,
    source: 'Yahoo Finance (^STOXX50E)',
  };
}

const FETCHERS: { id: MacroIndicatorId; label: string; fn: () => Promise<MacroIndicator> }[] = [
  { id: 'ecbRate', label: 'ECB Interest Rate', fn: fetchEcbRate },
  { id: 'eurUsd', label: 'EUR/USD', fn: fetchEurUsd },
  { id: 'inflation', label: 'Eurozone Inflation', fn: fetchInflation },
  { id: 'brent', label: 'Brent Crude', fn: fetchBrent },
  { id: 'vix', label: 'VIX Fear Index', fn: fetchVix },
  { id: 'stoxx50', label: 'Euro Stoxx 50', fn: fetchStoxx50 },
];

interface ResponseCacheEntry {
  expires: number;
  value: { data: MacroIndicator[]; generatedAt: string; unavailable: string[] };
}
let responseCache: ResponseCacheEntry | null = null;
let inFlight: Promise<ResponseCacheEntry['value']> | null = null;

async function computeMacro(): Promise<ResponseCacheEntry['value']> {
  const settled = await Promise.allSettled(FETCHERS.map((f) => f.fn()));
  const data: MacroIndicator[] = [];
  const unavailable: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      data.push(result.value);
    } else {
      // Honest about partial failure rather than fabricating a value for a source that's down —
      // matches how every other route in this app handles a data source being unreachable.
      unavailable.push(FETCHERS[i].label);
    }
  });
  return { data, generatedAt: new Date().toISOString(), unavailable };
}

export function macroRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      if (responseCache && responseCache.expires > Date.now()) {
        return res.json(responseCache.value);
      }
      if (!inFlight) {
        inFlight = computeMacro().finally(() => {
          inFlight = null;
        });
      }
      const value = await inFlight;
      responseCache = { expires: Date.now() + CACHE_TTL_MS, value };
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch macro data', detail: String(err) });
    }
  });

  return router;
}
