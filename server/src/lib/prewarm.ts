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

/**
 * Fire-and-forget — must never be awaited before app.listen(). Blocking server startup on this
 * would reproduce the exact Railway health-check failure already documented in index.ts: a slow
 * cold scan (the bulk insiders endpoint alone has taken ~80s in testing) would leave the port
 * unbound and every health check failing until it finished. Instead, the server starts accepting
 * requests immediately; this just improves the odds that the *first* real request lands on an
 * already-warm cache instead of triggering its own cold scan.
 */
export function prewarmCaches(): void {
  void warmBulkEndpoints();
  void warmTopTickerTechnicals();
}

async function warmBulkEndpoints(): Promise<void> {
  const targets: { label: string; run: () => Promise<unknown> }[] = [
    { label: 'macro', run: getCachedMacro },
    { label: 'institutions', run: getCachedInstitutions },
    { label: 'news', run: getCachedNews },
    { label: 'insiders', run: getCachedInsiders },
  ];
  const settled = await Promise.allSettled(targets.map((t) => t.run()));
  settled.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[prewarm] ${targets[i].label} failed:`, result.reason);
    } else {
      console.log(`[prewarm] ${targets[i].label} cache warm`);
    }
  });
}

async function warmTopTickerTechnicals(): Promise<void> {
  const top = TICKERS.slice(0, PREWARM_TICKER_COUNT);
  const settled = await Promise.allSettled(
    top.map(async (meta) => {
      const yahooSymbol = await resolveTickerYahooSymbol(meta);
      if (!yahooSymbol) throw new Error(`no Yahoo symbol for ${meta.symbol}`);
      await getTechnicals(meta.symbol, yahooSymbol);
    }),
  );
  const succeeded = settled.filter((r) => r.status === 'fulfilled').length;
  console.log(`[prewarm] technicals warm for ${succeeded}/${top.length} top tickers`);
}
