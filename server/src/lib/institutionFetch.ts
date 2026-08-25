import { FUNDS } from '../data/funds.js';
import { cikToPadded, listFilings, findInformationTableFile, fetchFilingDocXml } from './edgarFilings.js';
import { xmlParser, toArray, num } from './xml.js';
import type { IssuerMatcher } from './nameMatch.js';
import type { InstitutionalPosition, InstitutionalAction } from '../types.js';

interface HoldingRow {
  companyName: string;
  ticker: string;
  shares: number;
  value: number;
}

export function quarterLabel(reportDate: string): string {
  const [year, month] = reportDate.split('-').map(Number);
  const q = Math.ceil(month / 3);
  return `Q${q} ${year}`;
}

interface RawHoldingRow {
  issuerName: string;
  shares: number;
  value: number;
}

// A big filer's 13F XML can list 5,000-15,000+ holding rows (Vanguard, BlackRock, State Street,
// Fidelity), and fast-xml-parser building a full in-memory tree from that is synchronous, CPU-
// bound work that blocks Node's single thread — measured directly at ~450ms average per fund,
// which is why 10 funds "in parallel" were still taking 4.5s+ even with the underlying HTTP
// response fully cached: the network fetch was cached, but the parse was silently repeated on
// every single call regardless, once per search. Splitting "parse the filing into rows" (this
// cache) from "match those rows against one candidate company" (fetchHoldings below) means that
// cost is paid once per fund per quarter — shared across the bulk endpoint's full-universe scan
// and every ad-hoc search — rather than once per search. 13F filings are immutable once filed, so
// this can safely outlive every other cache in the app; it's only ever invalidated by a new
// accession number (a new quarter) appearing, which changes the cache key itself.
const PARSED_ROWS_CACHE_TTL_MS = 24 * 60 * 60_000;
const parsedRowsCache = new Map<string, { expires: number; rows: RawHoldingRow[] }>();

async function getParsedHoldingRows(cikPadded: string, accessionNoDash: string): Promise<RawHoldingRow[]> {
  const cacheKey = `${cikPadded}:${accessionNoDash}`;
  const cached = parsedRowsCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.rows;

  const infoFile = await findInformationTableFile(cikPadded, accessionNoDash);
  if (!infoFile) {
    parsedRowsCache.set(cacheKey, { expires: Date.now() + PARSED_ROWS_CACHE_TTL_MS, rows: [] });
    return [];
  }
  const xml = await fetchFilingDocXml(cikPadded, accessionNoDash, infoFile);
  const parsed = xmlParser.parse(xml)?.informationTable;
  const rawRows = toArray(parsed?.infoTable);

  const rows: RawHoldingRow[] = [];
  for (const row of rawRows) {
    const issuerName = row?.nameOfIssuer;
    if (!issuerName) continue;
    rows.push({
      issuerName,
      shares: num(row?.shrsOrPrnAmt?.sshPrnamt) ?? 0,
      // Prior to a Jan 2024 SEC rule change, Form 13F "value" was reported in thousands. Filings
      // since then report the exact dollar amount directly — verified against Berkshire's actual
      // Apple stake (raw value summed to ~$57.8B, matching reality, not $57.8T).
      value: num(row?.value) ?? 0,
    });
  }
  parsedRowsCache.set(cacheKey, { expires: Date.now() + PARSED_ROWS_CACHE_TTL_MS, rows });
  return rows;
}

export async function fetchHoldings<T extends { symbol: string; name: string }>(
  cikPadded: string,
  accessionNoDash: string,
  matcher: IssuerMatcher<T>,
): Promise<Map<string, HoldingRow>> {
  const rows = await getParsedHoldingRows(cikPadded, accessionNoDash);

  const holdings = new Map<string, HoldingRow>();
  for (const row of rows) {
    const match = matcher.match(row.issuerName);
    if (!match) continue;

    const existing = holdings.get(match.symbol);
    if (existing) {
      existing.shares += row.shares;
      existing.value += row.value;
    } else {
      holdings.set(match.symbol, {
        companyName: match.name,
        ticker: match.symbol,
        shares: row.shares,
        value: row.value,
      });
    }
  }
  return holdings;
}

export async function fetchFundPositionsForMatcher<T extends { symbol: string; name: string }>(
  fund: (typeof FUNDS)[number],
  matcher: IssuerMatcher<T>,
): Promise<InstitutionalPosition[]> {
  const cikPadded = cikToPadded(fund.cik);
  const filings = await listFilings(cikPadded, '13F-HR', 2);
  if (filings.length === 0) return [];

  const [current, prior] = filings;
  const [currentHoldings, priorHoldings] = await Promise.all([
    fetchHoldings(cikPadded, current.accessionNoDash, matcher),
    prior ? fetchHoldings(cikPadded, prior.accessionNoDash, matcher) : Promise.resolve(new Map<string, HoldingRow>()),
  ]);

  const positions: InstitutionalPosition[] = [];
  const quarter = quarterLabel(current.reportDate);

  for (const [ticker, holding] of currentHoldings) {
    const prev = priorHoldings.get(ticker);
    let action: InstitutionalAction;
    let pctChange: number;
    if (!prev) {
      action = 'new';
      pctChange = 100;
    } else if (holding.shares >= prev.shares) {
      action = 'increased';
      pctChange = prev.shares > 0 ? ((holding.shares - prev.shares) / prev.shares) * 100 : 100;
    } else {
      action = 'decreased';
      pctChange = prev.shares > 0 ? ((holding.shares - prev.shares) / prev.shares) * 100 : -100;
    }

    positions.push({
      id: `${fund.slug}-${ticker}-${current.reportDate}`,
      fundName: fund.name,
      fundSlug: fund.slug,
      ticker,
      companyName: holding.companyName,
      action,
      shares: holding.shares,
      marketValue: Math.round(holding.value),
      pctChange: Math.round(pctChange * 10) / 10,
      filingDate: current.filingDate,
      quarter,
    });
  }

  // Fully exited positions: held last period, gone this period.
  for (const [ticker, prevHolding] of priorHoldings) {
    if (currentHoldings.has(ticker)) continue;
    positions.push({
      id: `${fund.slug}-${ticker}-${current.reportDate}-exited`,
      fundName: fund.name,
      fundSlug: fund.slug,
      ticker,
      companyName: prevHolding.companyName,
      action: 'exited',
      shares: 0,
      marketValue: 0,
      pctChange: -100,
      filingDate: current.filingDate,
      quarter,
    });
  }

  return positions;
}
