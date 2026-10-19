import { extractText, getDocumentProxy } from 'unpdf';
import { fetchWithTimeout } from './fetchTimeout.js';
import { buildIssuerMatcher } from './nameMatch.js';
import { TICKERS } from '../data/tickers.js';
import { PARIS_LISTED_TICKERS } from '../data/parisTickers.js';
import type { InsiderTrade } from '../types.js';

// Native EU PDMR (MAR Article 19 "managers' transactions") data for French issuers, straight from
// the AMF's open BDIF register — no key, no paid provider. Each notification is a standardized
// PDF; the register's JSON listing gives issuer + publication date, and the figures (insider,
// role, buy/sell, price, volume) are parsed out of the PDF text. This is a real source, but only
// for AMF-supervised (French-listed) issuers: Germany (BaFin), Spain (CNMV), the Netherlands
// (AFM) etc. each run their own register, and none of those expose structured data this way.
//
// Why not SEC Form 4 for "dual-listed" EU companies: foreign private issuers (ASML, SAP, Roche,
// Airbus, Shell, Novartis…) are exempt from Section 16, so they file no Form 4 at all — the
// existing SEC pipeline already covers any tracked EU ticker that does file one, and it comes up
// empty for these.
const AMF_BASE = 'https://bdif.amf-france.org/back/api/v1';
const LOOKBACK_DAYS = 90;
const PAGE_SIZE = 100;
const MAX_PAGES = 25; // hard stop: ~2,500 filings, well over what 90 days holds
const PDF_CONCURRENCY = 4;
const MIN_VALUE = 25_000; // same spirit as the SEC pipeline's floor: only meaningfully sized trades
const SOURCE = 'AMF (France) PDMR';

interface AmfInformation {
  numero: string;
  datePublication: string;
  documents?: { path?: string | null; accessible?: boolean }[];
  societes?: { raisonSociale?: string | null; role?: string }[];
}
interface AmfListResponse {
  result?: AmfInformation[];
  total?: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function listRecentFilings(): Promise<AmfInformation[]> {
  const to = new Date();
  const from = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const all: AmfInformation[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${AMF_BASE}/informations?TypesInformation=DD&DateDebut=${isoDate(from)}&DateFin=${isoDate(to)}&Size=${PAGE_SIZE}&From=${page * PAGE_SIZE}`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (SmartMoneyDashboard)', Accept: 'application/json' } }, 10_000);
    if (!res.ok) throw new Error(`AMF listing failed: ${res.status}`);
    const body = (await res.json()) as AmfListResponse;
    const rows = body.result ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

// "7 794.0000" / "7 794,50" / "1.234,5" -> number. AMF's forms print a space thousands separator
// (sometimes a no-break space) and, in the French half, occasionally a comma decimal.
function parseNumber(raw: string): number | null {
  let s = raw.replace(/[\s\u00a0\u202f]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const CURRENCY_WORDS: [RegExp, string][] = [
  [/euro/i, 'EUR'],
  [/dollar/i, 'USD'],
  [/livre|sterling|gbp/i, 'GBP'],
  [/franc|chf/i, 'CHF'],
  [/couronne danoise|dkk/i, 'DKK'],
  [/couronne su[ée]doise|sek/i, 'SEK'],
];

function currencyFrom(text: string): string {
  for (const [re, code] of CURRENCY_WORDS) if (re.test(text)) return code;
  return 'EUR';
}

interface ParsedPdmr {
  insiderName: string;
  insiderTitle: string;
  type: 'BUY' | 'SELL';
  price: number;
  volume: number;
  currency: string;
}

// Parses the French half of the standardized notification (the PDF repeats itself in English;
// the first matches win). Returns null for anything that isn't a plain open-market acquisition or
// disposal — subscriptions, option exercises, pledges, gifts and free-share awards say little
// about conviction and are skipped on purpose.
export function parsePdmrText(text: string): ParsedPdmr | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  const nature = lines.find((l) => /^NATURE DE LA TRANSACTION\s*:/i.test(l));
  if (!nature) return null;
  const natureValue = nature.replace(/^NATURE DE LA TRANSACTION\s*:\s*/i, '').toLowerCase();
  let type: 'BUY' | 'SELL';
  if (/^acquisition/.test(natureValue)) type = 'BUY';
  else if (/^cession/.test(natureValue)) type = 'SELL';
  else return null;

  // Person: the line after the "NOM /FONCTION ..." header, "NAME, Function".
  const headerIdx = lines.findIndex((l) => /^NOM\s*\/\s*FONCTION/i.test(l));
  let person = '';
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < Math.min(lines.length, headerIdx + 6); i++) {
      // the header sentence wraps onto a second line ("PERSONNE ETROITEMENT LIEE :") before the name
      if (!lines[i] || /ETROITEMENT LIEE\s*:?$/i.test(lines[i]) || /^PERSONNE/i.test(lines[i])) continue;
      person = lines[i];
      break;
    }
  }
  if (!person) return null;
  const comma = person.indexOf(',');
  const insiderName = (comma >= 0 ? person.slice(0, comma) : person).trim();
  const insiderTitle = (comma >= 0 ? person.slice(comma + 1) : 'Person closely associated').trim();

  // Prefer the aggregated figures (a notification can bundle several fills); fall back to the
  // per-operation unit price/volume.
  const aggIdx = lines.findIndex((l) => /^INFORMATIONS AGREGEES/i.test(l));
  const scope = aggIdx >= 0 ? lines.slice(aggIdx) : lines;
  const priceLine = scope.find((l) => /^PRIX\s*:/i.test(l)) ?? lines.find((l) => /^PRIX UNITAIRE\s*:/i.test(l));
  const volumeLine = scope.find((l) => /^VOLUME\s*:/i.test(l)) ?? lines.find((l) => /^VOLUME\s*:/i.test(l));
  if (!priceLine || !volumeLine) return null;

  const priceRaw = priceLine.replace(/^PRIX( UNITAIRE)?\s*:\s*/i, '');
  const priceMatch = /([\d\s\u00a0\u202f.,]+\d)/.exec(priceRaw);
  const volumeMatch = /([\d\s\u00a0\u202f.,]+\d)/.exec(volumeLine.replace(/^VOLUME\s*:\s*/i, ''));
  if (!priceMatch || !volumeMatch) return null;
  const price = parseNumber(priceMatch[1]);
  const volume = parseNumber(volumeMatch[1]);
  if (price === null || volume === null || price <= 0 || volume <= 0) return null;

  return { insiderName, insiderTitle, type, price, volume, currency: currencyFrom(priceRaw) };
}

async function fetchAndParsePdf(path: string): Promise<ParsedPdmr | null> {
  const res = await fetchWithTimeout(`${AMF_BASE}/documents/${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 (SmartMoneyDashboard)' } }, 10_000);
  if (!res.ok) throw new Error(`AMF document failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return parsePdmrText(text);
}

// Parsed notifications never change once published, so each is downloaded/parsed once per
// process; later scans only pay for the listing call plus any new filings. `null` is cached too
// (a skipped notification type stays skipped).
const parsedCache = new Map<string, ParsedPdmr | null>();

export interface AmfScanResult {
  trades: InsiderTrade[];
  filingsListed: number;
  filingsMatched: number;
}

export async function fetchAmfInsiderTrades(): Promise<AmfScanResult> {
  const euTickers = TICKERS.filter((t) => t.market === 'EU' && PARIS_LISTED_TICKERS.has(t.symbol));
  const matcher = buildIssuerMatcher(euTickers);

  const filings = await listRecentFilings();
  const matched: { filing: AmfInformation; ticker: string; path: string }[] = [];
  for (const filing of filings) {
    const issuer = filing.societes?.find((s) => s.role === 'SocieteConcernee')?.raisonSociale ?? filing.societes?.[0]?.raisonSociale;
    const path = filing.documents?.find((d) => d.path && d.accessible !== false)?.path;
    if (!issuer || !path) continue;
    const hit = matcher.match(issuer);
    if (hit) matched.push({ filing, ticker: hit.symbol, path });
  }

  const trades: InsiderTrade[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < matched.length) {
      const item = matched[cursor++];
      try {
        let parsed = parsedCache.get(item.filing.numero);
        if (parsed === undefined) {
          parsed = await fetchAndParsePdf(item.path);
          parsedCache.set(item.filing.numero, parsed);
        }
        if (!parsed) continue;
        const value = Math.round(parsed.price * parsed.volume);
        if (value < MIN_VALUE) continue;
        trades.push({
          id: `amf-${item.filing.numero}`,
          ticker: item.ticker,
          insiderName: parsed.insiderName,
          insiderTitle: parsed.insiderTitle,
          transactionType: parsed.type,
          shares: Math.round(parsed.volume),
          price: parsed.price,
          value,
          filingDate: item.filing.datePublication,
          market: 'EU',
          source: SOURCE,
          currency: parsed.currency,
        });
      } catch {
        // one unreadable notification shouldn't sink the rest
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PDF_CONCURRENCY, matched.length) }, worker));

  return { trades, filingsListed: filings.length, filingsMatched: matched.length };
}
