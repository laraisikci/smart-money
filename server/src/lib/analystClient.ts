import { getYahooSession } from './yahooAuth.js';
import { fetchWithTimeout } from './fetchTimeout.js';

export interface AnalystRating {
  recommendationMean: number; // Yahoo's own scale: 1 = Strong Buy ... 5 = Strong Sell
  recommendationKey: string; // e.g. 'strongBuy', 'buy', 'hold', 'sell', 'strongSell'
  numberOfAnalysts: number;
  targetMeanPrice: number | null;
}

interface FinancialDataModule {
  recommendationMean?: { raw?: number };
  recommendationKey?: string;
  numberOfAnalystOpinions?: { raw?: number };
  targetMeanPrice?: { raw?: number };
}
interface QuoteSummaryResponse {
  quoteSummary?: { result?: [{ financialData?: FinancialDataModule }] | null };
}

const USER_AGENT = 'Mozilla/5.0 (SmartMoneyDashboard)';

async function fetchOnce(yahooSymbol: string, cookie: string, crumb: string): Promise<Response> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}?modules=financialData&crumb=${encodeURIComponent(crumb)}`;
  return fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT, Cookie: cookie } });
}

/**
 * Best-effort — returns null on any failure (no session, expired crumb even after one retry,
 * unexpected response shape, network error) so the caller always has a clean way to say "no
 * analyst data" rather than guessing. See yahooAuth.ts for why this needs a cookie+crumb at all.
 */
export async function fetchAnalystRating(yahooSymbol: string): Promise<AnalystRating | null> {
  try {
    let sess = await getYahooSession();
    if (!sess) return null;

    let res = await fetchOnce(yahooSymbol, sess.cookie, sess.crumb);
    if (res.status === 401) {
      sess = await getYahooSession(true);
      if (!sess) return null;
      res = await fetchOnce(yahooSymbol, sess.cookie, sess.crumb);
    }
    if (!res.ok) return null;

    const data = (await res.json()) as QuoteSummaryResponse;
    const fd = data.quoteSummary?.result?.[0]?.financialData;
    const mean = fd?.recommendationMean?.raw;
    const key = fd?.recommendationKey;
    if (mean === undefined || !key) return null;

    return {
      recommendationMean: mean,
      recommendationKey: key,
      numberOfAnalysts: fd?.numberOfAnalystOpinions?.raw ?? 0,
      targetMeanPrice: fd?.targetMeanPrice?.raw ?? null,
    };
  } catch {
    return null;
  }
}
