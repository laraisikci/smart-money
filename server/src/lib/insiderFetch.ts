import { listFilings, primaryDocBasename, fetchFilingDocXml } from './edgarFilings.js';
import { xmlParser, toArray, num } from './xml.js';
import type { InsiderTrade } from '../types.js';

// Genuine open-market C-suite/director buys above $50k are much rarer than the routine RSU
// vesting/withholding noise that dominates most Form 4s — looks back this far per ticker to have
// a reasonable chance of surfacing real qualifying buys rather than coming back empty.
const FILINGS_PER_TICKER = 20;
const TRANSACTIONS_PER_FILING = 6;
const MIN_TRADE_VALUE = 50_000;
const MAX_AGE_DAYS = 90;

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// Matches SEC's own officerTitle free text (e.g. "Chief Executive Officer", "Chairman and CEO",
// "President and COO", "Co-CEO", "Chair of the Board") against the CEO/CFO/COO/President/
// Chairman roles the app cares about.
const QUALIFYING_OFFICER_ROLE =
  /chief executive officer|\bceo\b|chief financial officer|\bcfo\b|chief operating officer|\bcoo\b|\bpresident\b|\bchair(?:man|woman|person)?\b/i;

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
  // not the string '1' or the boolean true.
  const truthy = (v: unknown) => v === true || v === 'true' || v === '1' || v === 1;
  const isOfficer = truthy(rel.isOfficer);
  const isDirector = truthy(rel.isDirector);

  if (isOfficer && rel.officerTitle && QUALIFYING_OFFICER_ROLE.test(rel.officerTitle)) {
    return { title: rel.officerTitle, qualifies: true };
  }
  if (isDirector) {
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

export async function fetchInsiderTradesForTicker(
  ticker: string,
  market: 'EU' | 'US',
  cik: string,
): Promise<InsiderTrade[]> {
  const filings = await listFilings(cik, '4', FILINGS_PER_TICKER);
  const trades: InsiderTrade[] = [];

  for (const filing of filings) {
    // listFilings returns filings newest-first, so once one is older than the recency window,
    // everything after it is too — stop fetching XML entirely instead of paying for a fetch we
    // already know will be filtered out.
    if (daysAgo(filing.reportDate) > MAX_AGE_DAYS) break;

    try {
      const filename = primaryDocBasename(filing.primaryDocument);
      const xml = await fetchFilingDocXml(cik, filing.accessionNoDash, filename);
      const doc = xmlParser.parse(xml)?.ownershipDocument;
      if (!doc) continue;

      // Form 4 allows multiple joint reportingOwner entries per filing — check every owner on
      // the filing and use the first one that actually qualifies.
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
      if (!role.qualifies) continue;

      const nonDerivative = toArray(doc.nonDerivativeTable?.nonDerivativeTransaction);
      let seq = 0;
      for (const txn of nonDerivative) {
        if (seq >= TRANSACTIONS_PER_FILING) break;
        const code = txn?.transactionCoding?.transactionCode;
        // Only open-market purchases — drops sells (including 10b5-1 plan sales), option
        // exercises ('M'), and tax withholding ('F').
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
