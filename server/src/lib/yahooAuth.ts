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

async function fetchSession(): Promise<YahooSession | null> {
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': USER_AGENT } });
    const setCookie = cookieRes.headers.get('set-cookie');
    const cookie = setCookie?.split(';')[0];
    if (!cookie) return null;

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': USER_AGENT, Cookie: cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes('Invalid') || crumb.includes('<html')) return null;

    return { cookie, crumb, expires: Date.now() + SESSION_TTL_MS };
  } catch {
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
