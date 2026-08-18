import { fetchYahooJson } from './newsClient.js';
import { normalize } from './nameMatch.js';
import type { TickerMeta } from '../data/tickers.js';

// Yahoo's RSS-by-ticker endpoint resolves *bare* symbols against its whole global instrument
// universe, not just our intended company — verified directly: bare "MC" (our internal LVMH
// symbol) returns news for Moelis & Company (a US investment bank), and bare "OR" (our L'Oréal
// symbol) returns news for OR Royalties Inc. (a Canadian mining royalty company). Silently
// showing the wrong company's news under our ticker would be worse than showing none, so EU
// tickers are resolved to Yahoo's disambiguated symbol (e.g. "MC.PA", "OR.PA") by searching on
// company name first. US tickers skip this — our whole US list is real major NYSE/Nasdaq
// large-caps, which are unambiguously their own bare Yahoo symbol.
const PREFERRED_EXCHANGES = new Set([
  'PAR', // Paris
  'GER', 'FRA', 'ETR', // Frankfurt/Xetra
  'AMS', // Amsterdam
  'MCE', // Madrid
  'MIL', // Milan
  'LSE', 'LON', // London
  'SWX', 'VTX', 'EBS', // Swiss
  'CPH', // Copenhagen
  'BRU', // Brussels
]);

interface YahooSearchQuote {
  symbol?: string;
  exchange?: string;
  quoteType?: string;
}
interface YahooSearchResponse {
  quotes?: YahooSearchQuote[];
}

const RESOLVE_CACHE_TTL_MS = 7 * 24 * 60 * 60_000; // a company's Yahoo symbol essentially never changes

async function search(query: string): Promise<string | null> {
  const data = await fetchYahooJson<YahooSearchResponse>(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`,
    RESOLVE_CACHE_TTL_MS,
  );
  // Yahoo already ranks quotes by its own relevance score, highest first — just filter out
  // non-equity instruments (bonds, CDRs on non-primary venues) and take the first survivor.
  const match = (data.quotes ?? []).find(
    (q) => q.quoteType === 'EQUITY' && q.exchange && PREFERRED_EXCHANGES.has(q.exchange),
  );
  return match?.symbol ?? null;
}

export async function resolveYahooSymbol(companyName: string): Promise<string | null> {
  // normalize() turns apostrophes into spaces for substring-matching purposes elsewhere (see
  // nameMatch.ts) — fine there, but it specifically breaks Yahoo's search ranking here, verified
  // directly: querying "l oreal" (space) fails to surface the real listing at all, while
  // "loreal" (apostrophe just deleted, no space introduced) puts it first. Deleting the
  // apostrophe before normalizing keeps this a same-single-word name instead of turning it into
  // two, without touching genuinely multi-word names like "Deutsche Bank".
  const normalized = normalize(companyName.replace(/['’]/g, '')); // "BMW AG" -> "bmw"
  if (!normalized) return null;

  try {
    const direct = await search(normalized);
    if (direct) return direct;

    // Multi-word compound names (e.g. "LVMH Moet Hennessy") can rank worse on Yahoo's search
    // than just the most distinctive leading word ("lvmh") — verified directly: the full
    // normalized name returns no usable match for LVMH, but "lvmh" alone puts the correct
    // MC.PA first. Only worth retrying when there's more than one word to drop.
    const firstWord = normalized.split(' ')[0];
    if (firstWord && firstWord !== normalized) {
      return await search(firstWord);
    }
    return null;
  } catch {
    return null;
  }
}

// A couple of EU tickers where Yahoo's own search doesn't reliably surface the correct primary
// listing even after name normalization — verified directly (see resolveYahooSymbol above):
// "sanofi" surfaces a secondary Frankfurt listing (SNW.F) instead of the Paris primary. Checked
// before the generic resolver; not an attempt to hand-map all ~150 EU tickers, just the ones a
// concrete test showed were wrong. Shared by every route that needs a ticker's Yahoo symbol
// (news headlines, technical indicators) so the override list only lives in one place.
const YAHOO_SYMBOL_OVERRIDES: Record<string, string> = {
  SAN: 'SAN.PA',
};

export async function resolveTickerYahooSymbol(meta: TickerMeta): Promise<string | null> {
  // US tickers are all real major NYSE/Nasdaq large-caps — unambiguously their own bare Yahoo
  // symbol, no resolution needed. EU tickers need disambiguation (see comment above
  // PREFERRED_EXCHANGES for why bare local symbols collide with unrelated companies on Yahoo).
  if (meta.market === 'US') return meta.symbol;
  return YAHOO_SYMBOL_OVERRIDES[meta.symbol] ?? resolveYahooSymbol(meta.name);
}
