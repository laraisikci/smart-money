import { Router } from 'express';
import { TICKERS } from '../data/tickers.js';
import { resolveCik } from '../lib/cikResolver.js';
import { listFilings, primaryDocBasename, fetchFilingDocXml } from '../lib/edgarFilings.js';
import { xmlParser, toArray, num } from '../lib/xml.js';
import type { InsiderTrade } from '../types.js';

// Genuine open-market C-suite/director buys above $50k are much rarer than the routine RSU
// vesting/withholding noise that dominates most Form 4s (empirically: ~1 qualifying buy per 14
// open-market purchases across our whole tracked universe in a 10-filing window) — this looks
// back further per ticker than before (was 5) to have a reasonable chance of surfacing real
// qualifying buys rather than coming back empty for tickers whose recent filings are all
// routine. Even so, expect this endpoint to return few results most of the time — that's
// inherent to what makes an open-market insider buy a meaningful signal in the first place.
const FILINGS_PER_TICKER = 20;
const TRANSACTIONS_PER_FILING = 6;
const MIN_TRADE_VALUE = 50_000;
const MAX_AGE_DAYS = 90;
const RESPONSE_CACHE_TTL_MS = 6 * 60 * 60_000; // 6h — the universe is now large enough (250+
// tickers) that recomputing on every cache miss is expensive; longer caching plus the request
// coalescing below (see inFlight) are what actually protect against SEC rate limiting, more so
// than the batching itself, since the shared secClient throttle already serializes dispatch
// regardless of caller concurrency — the real risk was multiple *concurrent* cold-cache requests
// each independently kicking off a full scan.
const TICKER_BATCH_SIZE = 20;

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// Matches SEC's own officerTitle free text (e.g. "Chief Executive Officer", "Chairman and CEO",
// "President and COO", "Co-CEO", "Chair of the Board") against the CEO/CFO/COO/President/
// Chairman roles the app cares about.
const QUALIFYING_OFFICER_ROLE = /chief executive officer|\bceo\b|chief financial officer|\bcfo\b|chief operating officer|\bcoo\b|\bpresident\b|\bchair(?:man|woman|person)?\b/i;

interface ResponseCacheEntry {
  expires: number;
  value: { data: InsiderTrade[]; generatedAt: string; coverage: { resolved: string[]; unresolved: string[] } };
}
let responseCache: ResponseCacheEntry | null = null;

interface RoleClassification {
  title: string;
  qualifies: boolean;
}

// Filters to the roles the "meaningful buys" feature cares about: CEO, CFO, COO, President,
// Chairman, or Director. SEC's officerTitle field is free text (not a controlled vocabulary),
// so officer roles are pattern-matched; isDirector is its own boolean flag independent of
// officerTitle. A plain officer title that doesn't match (e.g. "SVP, GC and Secretary", "Chief
// Accounting Officer") or a bare 10% owner does not qualify.
function classifyRole(rel: {
  isOfficer?: boolean | string;
  officerTitle?: string;
  isDirector?: boolean | string;
  isTenPercentOwner?: boolean | string;
}): RoleClassification {
  // SEC's Form 4 schema represents these as "1"/"0", but fast-xml-parser auto-converts
  // numeric-looking text content to actual JS numbers — so the real value here is the number 1,
  // not the string '1' or the boolean true. Missing the number case meant isDirector/isOfficer
  // never matched at all, silently (this bug predates today's filtering — it just had no
  // visible effect before because nothing depended on these flags being correct).
  const truthy = (v: unknown) => v === true || v === 'true' || v === '1' || v === 1;
  const isOfficer = truthy(rel.isOfficer);
  const isDirector = truthy(rel.isDirector);

  if (isOfficer && rel.officerTitle && QUALIFYING_OFFICER_ROLE.test(rel.officerTitle)) {
    return { title: rel.officerTitle, qualifies: true };
  }
  if (isDirector) {
    // Prefer a more specific officer title if one exists (e.g. a director who's also Chairman),
    // even if it didn't match the qualifying pattern above — being a director already qualifies.
    return { title: isOfficer && rel.officerTitle ? rel.officerTitle : 'Director', qualifies: true };
  }
  if (isOfficer && rel.officerTitle) {
    return { title: rel.officerTitle, qualifies: false };
  }
  if (truthy(rel.isTenPercentOwner)) {
    return { title: '10% Owner', qualifies: false };
  }
  return { title: 'Insider', qualifies: false };
}

async function fetchInsiderTradesForTicker(
  ticker: string,
  market: 'EU' | 'US',
  cik: string,
): Promise<InsiderTrade[]> {
  const filings = await listFilings(cik, '4', FILINGS_PER_TICKER);
  const trades: InsiderTrade[] = [];

  for (const filing of filings) {
    // listFilings returns filings newest-first, so once one is older than the recency window,
    // everything after it is too — stop fetching XML entirely instead of paying for a fetch we
    // already know will be filtered out. This matters a lot more now that the universe is 250+
    // tickers instead of ~30: without it, actively-filing large caps would burn their full
    // FILINGS_PER_TICKER budget on routine old filings well past 90 days.
    if (daysAgo(filing.reportDate) > MAX_AGE_DAYS) break;

    try {
      const filename = primaryDocBasename(filing.primaryDocument);
      const xml = await fetchFilingDocXml(cik, filing.accessionNoDash, filename);
      const doc = xmlParser.parse(xml)?.ownershipDocument;
      if (!doc) continue;

      // Form 4 allows multiple joint reportingOwner entries per filing (e.g. an individual
      // filing alongside an affiliated entity) — fast-xml-parser only gives an array when there
      // are 2+, so a single filer is a plain object. Check every owner on the filing and use
      // the first one that actually qualifies, rather than assuming there's exactly one.
      const owners = toArray(doc.reportingOwner);
      let owner = 'Unknown';
      let role: RoleClassification = { title: 'Insider', qualifies: false };
      for (const o of owners) {
        const candidate = classifyRole(o?.reportingOwnerRelationship ?? {});
        if (candidate.qualifies) {
          owner = o?.reportingOwnerId?.rptOwnerName ?? 'Unknown';
          role = candidate;
          break;
        }
      }
      if (!role.qualifies) continue; // no reporting owner on this filing is CEO/CFO/COO/President/Chairman/Director

      const nonDerivative = toArray(doc.nonDerivativeTable?.nonDerivativeTransaction);
      let seq = 0;
      for (const txn of nonDerivative) {
        if (seq >= TRANSACTIONS_PER_FILING) break;
        const code = txn?.transactionCoding?.transactionCode;
        // Only open-market purchases. This drops sells entirely (including 10b5-1 plan sales,
        // which file under 'S' with no separate code), option exercises ('M'), and tax
        // withholding ('F') — "meaningful buys" only, not the noisy mix of every Form 4 line.
        if (code !== 'P') continue;

        const shares = num(txn?.transactionAmounts?.transactionShares?.value);
        const price = num(txn?.transactionAmounts?.transactionPricePerShare?.value);
        const txnDate = txn?.transactionDate?.value ?? filing.reportDate;
        if (!shares || !price) continue;

        const value = Math.round(shares * price);
        if (value <= MIN_TRADE_VALUE) continue;

        trades.push({
          id: `${filing.accessionNumber}-${seq}`,
          ticker,
          insiderName: owner,
          insiderTitle: role.title,
          transactionType: 'BUY',
          shares,
          price,
          value,
          filingDate: txnDate,
          market,
        });
        seq++;
      }
    } catch {
      // one bad filing shouldn't take down the whole ticker
      continue;
    }
  }

  return trades;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function computeInsiders(): Promise<ResponseCacheEntry['value']> {
  const resolved: string[] = [];
  const unresolved: string[] = [];
  const results: InsiderTrade[][] = [];

  // Process in batches of 20 tickers rather than one Promise.all across the whole (250+ ticker)
  // universe — bounds how many filings/XML fetches are in flight at once, and keeps a single
  // slow or hanging ticker from holding up the whole batch's worth of concurrent work.
  for (const batch of chunk(TICKERS, TICKER_BATCH_SIZE)) {
    const batchResults = await Promise.all(
      batch.map(async (meta) => {
        const cikInfo = await resolveCik(meta);
        if (!cikInfo) {
          unresolved.push(meta.symbol);
          return [] as InsiderTrade[];
        }
        resolved.push(meta.symbol);
        try {
          return await fetchInsiderTradesForTicker(meta.symbol, meta.market, cikInfo.cikPadded);
        } catch {
          return [] as InsiderTrade[];
        }
      }),
    );
    results.push(...batchResults);
  }

  const data = results
    .flat()
    .sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());

  return { data, generatedAt: new Date().toISOString(), coverage: { resolved, unresolved } };
}

// If a request arrives while a computation is already running (e.g. right after the 6h cache
// expires, or during initial warmup), it awaits this same in-flight promise instead of kicking
// off a second full scan of the ticker universe. Without this, N concurrent cold-cache requests
// multiply the SEC request volume by N through the exact same shared throttle — this is what
// actually caused SEC EDGAR to start timing out on us during testing, not insufficient batching.
let inFlight: Promise<ResponseCacheEntry['value']> | null = null;

export function insidersRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      if (responseCache && responseCache.expires > Date.now()) {
        return res.json(responseCache.value);
      }

      if (!inFlight) {
        inFlight = computeInsiders().finally(() => {
          inFlight = null;
        });
      }
      const value = await inFlight;

      responseCache = { expires: Date.now() + RESPONSE_CACHE_TTL_MS, value };
      res.json(value);
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch SEC EDGAR Form 4 data', detail: String(err) });
    }
  });

  return router;
}
