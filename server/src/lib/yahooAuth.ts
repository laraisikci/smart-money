// Yahoo's quoteSummary endpoint (used only for analyst ratings — see analystClient.ts) requires
// a session cookie plus a matching "crumb" token. This is undocumented and verified by hand: a
// request with neither gets a 401 "Invalid Cookie"; the crumb alone without the cookie that
// produced it gets a 401 "Invalid Crumb"; fc.yahoo.com returns a 404 itself but its response
// carries the Set-Cookie header that authorizes the crumb endpoint. Every other Yahoo endpoint
// this app uses (chart, RSS headlines, symbol search) needs none of this.
//
// This is best-effort scaffolding around an undocumented mechanism, not a stable public API — a
// failure at any step here should degrade to "no analyst data" (see analystClient.ts), never
// break anything else.
import { fetchWithTimeout } from './fetchTimeout.js';

const USER_AGENT = 'Mozilla/5.0 (SmartMoneyDashboard)';

// Yahoo's own responses report a 24h maxAge on this data; refreshing a bit before that avoids
// ever serving on an already-expired crumb.
const SESSION_TTL_MS = 20 * 60 * 60_000;

interface YahooSession {
  cookie: string;
  crumb: string;
  expires: number;
}

let session: YahooSession | null = null;
let inFlight: Promise<YahooSession | null> | null = null;

// Logged rather than silently swallowed — this flow works reliably from a residential IP but
// has been consistently returning no analyst data from Render, and blanket try/catch → null
// gave no way to tell "Yahoo blocked this request" from "a parsing bug" from "network error".
// A single fetch, when it does surface, degrades exactly like before (analystClient.ts already
// treats a null session as "no analyst data").
async function fetchSession(): Promise<YahooSession | null> {
  try {
    const cookieRes = await fetchWithTimeout('https://fc.yahoo.com', { headers: { 'User-Agent': USER_AGENT } });
    // Node's fetch Headers.get() collapses multiple Set-Cookie headers into one comma-joined
    // string — getSetCookie() (added specifically because that collapse is lossy/ambiguous) is
    // the correct way to read them individually.
    const setCookies = typeof cookieRes.headers.getSetCookie === 'function' ? cookieRes.headers.getSetCookie() : [];
    const cookie = setCookies[0]?.split(';')[0] ?? cookieRes.headers.get('set-cookie')?.split(';')[0];
    if (!cookie) {
      console.error(
        `[yahooAuth] fc.yahoo.com gave no Set-Cookie — status ${cookieRes.status}, header count ${setCookies.length}`,
      );
      return null;
    }

    const crumbRes = await fetchWithTimeout('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': USER_AGENT, Cookie: cookie },
    });
    if (!crumbRes.ok) {
      console.error(`[yahooAuth] getcrumb failed — status ${crumbRes.status} ${crumbRes.statusText}`);
      return null;
    }
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('Invalid') || crumb.includes('<html')) {
      console.error(`[yahooAuth] getcrumb returned an unusable crumb: ${crumb.slice(0, 200)}`);
      return null;
    }

    return { cookie, crumb, expires: Date.now() + SESSION_TTL_MS };
  } catch (err) {
    console.error('[yahooAuth] session fetch threw:', err);
    return null;
  }
}

// `forceRefresh` lets a caller that got a 401 on a stale crumb get a fresh session for one retry,
// without every other concurrent caller also independently re-authenticating.
export async function getYahooSession(forceRefresh = false): Promise<YahooSession | null> {
  if (!forceRefresh && session && session.expires > Date.now()) return session;
  if (!inFlight) {
    inFlight = fetchSession().finally(() => {
      inFlight = null;
    });
  }
  const result = await inFlight;
  session = result;
  return result;
}
