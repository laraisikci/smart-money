import { Router } from 'express';
import { TICKERS } from '../data/tickers.js';
import { FUNDS } from '../data/funds.js';
import { cikToPadded, listFilings, findInformationTableFile, fetchFilingDocXml } from '../lib/edgarFilings.js';
import { xmlParser, toArray, num } from '../lib/xml.js';
import { matchIssuerName } from '../lib/nameMatch.js';
import type { InstitutionalPosition, InstitutionalAction } from '../types.js';

interface HoldingRow {
  companyName: string;
  ticker: string;
  shares: number;
  value: number;
}

function quarterLabel(reportDate: string): string {
  const [year, month] = reportDate.split('-').map(Number);
  const q = Math.ceil(month / 3);
  return `Q${q} ${year}`;
}

async function fetchHoldings(cikPadded: string, accessionNoDash: string): Promise<Map<string, HoldingRow>> {
  const infoFile = await findInformationTableFile(cikPadded, accessionNoDash);
  if (!infoFile) return new Map();
  const xml = await fetchFilingDocXml(cikPadded, accessionNoDash, infoFile);
  const parsed = xmlParser.parse(xml)?.informationTable;
  const rows = toArray(parsed?.infoTable);

  const holdings = new Map<string, HoldingRow>();
  for (const row of rows) {
    const issuerName = row?.nameOfIssuer;
    if (!issuerName) continue;
    const match = matchIssuerName(issuerName, TICKERS);
    if (!match) continue;

    const shares = num(row?.shrsOrPrnAmt?.sshPrnamt) ?? 0;
    // Prior to a Jan 2024 SEC rule change, Form 13F "value" was reported in thousands. Filings
    // since then report the exact dollar amount directly — verified against Berkshire's actual
    // Apple stake (raw value summed to ~$57.8B, matching reality, not $57.8T).
    const value = num(row?.value) ?? 0;
    const existing = holdings.get(match.symbol);
    if (existing) {
      existing.shares += shares;
      existing.value += value;
    } else {
      holdings.set(match.symbol, {
        companyName: match.name,
        ticker: match.symbol,
        shares,
        value,
      });
    }
  }
  return holdings;
}

async function fetchFundPositions(fund: (typeof FUNDS)[number]): Promise<InstitutionalPosition[]> {
  const cikPadded = cikToPadded(fund.cik);
  const filings = await listFilings(cikPadded, '13F-HR', 2);
  if (filings.length === 0) return [];

  const [current, prior] = filings;
  const [currentHoldings, priorHoldings] = await Promise.all([
    fetchHoldings(cikPadded, current.accessionNoDash),
    prior ? fetchHoldings(cikPadded, prior.accessionNoDash) : Promise.resolve(new Map<string, HoldingRow>()),
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

interface ResponseCacheEntry {
  expires: number;
  value: { data: InstitutionalPosition[]; generatedAt: string; failedFunds: string[] };
}
let responseCache: ResponseCacheEntry | null = null;

export function institutionsRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      if (responseCache && responseCache.expires > Date.now()) {
        return res.json(responseCache.value);
      }

      const failedFunds: string[] = [];
      const perFund = await Promise.all(
        FUNDS.map(async (fund) => {
          try {
            return await fetchFundPositions(fund);
          } catch {
            failedFunds.push(fund.name);
            return [] as InstitutionalPosition[];
          }
        }),
      );

      const data = perFund
        .flat()
        .sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());

      const value = { data, generatedAt: new Date().toISOString(), failedFunds };
      responseCache = { expires: Date.now() + 30 * 60_000, value };
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch SEC EDGAR 13F data', detail: String(err) });
    }
  });

  return router;
}
