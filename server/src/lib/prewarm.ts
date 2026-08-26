import { TICKERS } from '../data/tickers.js';
import { resolveTickerYahooSymbol } from './yahooSymbolResolver.js';
import { getTechnicals } from './technicalsFetch.js';
import { getCachedInsiders } from '../routes/insiders.js';
import { getCachedInstitutions } from '../routes/institutions.js';
import { getCachedNews } from '../routes/news.js';
import { getCachedMacro } from '../routes/macro.js';

// No "most popular" or "highest conviction" ranking exists server-side (conviction scores are
// computed client-side from data this server doesn't rank) — this is honestly just the first 20
// entries in the tracked list, not a curated top 20.
const PREWARM_TICKER_COUNT = 20;

// Give the server a moment to finish binding its port and start passing health checks cleanly
// before piling on extra load — see the delay note in prewarmCaches() below.
const STARTUP_DELAY_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fire-and-forget — must never be awaited before app.listen(). Blocking server startup on this
 * would reproduce the exact Railway health-check failure already documented in index.ts.
 *
 * Runs everything SEQUENTIALLY, not in parallel, and on a small delay after startup. The original
 * version fired all 4 bulk scans plus 20 individual technicals fetches simultaneously via
 * Promise.allSettled — fine on a dev machine, but verified directly to make things *worse* on
 * Render's free tier: the bulk /api/institutions endpoint (10 funds, large synchronous XML
 * parses) was still timing out on live requests minutes after a deploy, competing for the same
 * constrained CPU as prewarm's own concurrent burst of work. Free-tier CPU is shared/throttled,
 * not just "less of it" — spreading the same total work out sequentially, one task fully
 * finishing before the next starts, lets real user requests actually get scheduled in between
 * instead of queuing behind a pile of prewarm tasks that were all launched at once. Slower to
 * finish warming everything, but the service stays responsive to live traffic the whole time
 * instead of being unusable for however long the burst takes.
 *
 * Ordered cheapest/most time-sensitive first, heaviest (institutions — 13F data that only changes
 * quarterly anyway) last.
 */
export function prewarmCaches(): void {
  void runSequentially();
}

async function runSequentially(): Promise<void> {
  await sleep(STARTUP_DELAY_MS);

  await warmOne('macro', getCachedMacro);
  await warmOne('news', getCachedNews);
  await warmOne('insiders', getCachedInsiders);
  await warmTopTickerTechnicals();
  await warmOne('institutions', getCachedInstitutions);
}

async function warmOne(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
    console.log(`[prewarm] ${label} cache warm`);
  } catch (err) {
    console.error(`[prewarm] ${label} failed:`, err);
  }
}

async function warmTopTickerTechnicals(): Promise<void> {
  const top = TICKERS.slice(0, PREWARM_TICKER_COUNT);
  let succeeded = 0;
  for (const meta of top) {
    try {
      const yahooSymbol = await resolveTickerYahooSymbol(meta);
      if (!yahooSymbol) throw new Error(`no Yahoo symbol for ${meta.symbol}`);
      await getTechnicals(meta.symbol, yahooSymbol);
      succeeded++;
    } catch {
      // one ticker failing shouldn't stop the rest from warming
    }
  }
  console.log(`[prewarm] technicals warm for ${succeeded}/${top.length} top tickers`);
}
