import { fetchNewsRss } from './newsClient.js';
import { xmlParser, toArray } from './xml.js';
import { classifySentiment } from './sentiment.js';
import type { NewsHeadline } from '../types.js';

const HEADLINES_PER_TICKER = 5;
const RSS_CACHE_TTL_MS = 2 * 60 * 60_000; // 2h, matches the bulk /api/news response cache

interface RssItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
}

// Pure by yahoo symbol — no dependency on the tracked TICKERS universe or TickerMeta, so this
// works for a pre-tracked ticker (already resolved to a yahoo symbol) or an ad-hoc search result
// (which already carries its own real yahoo symbol straight from Yahoo's own search endpoint).
export async function fetchNewsForYahooSymbol(yahooSymbol: string, ourTicker: string): Promise<NewsHeadline[]> {
  const xml = await fetchNewsRss(
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(yahooSymbol)}`,
    RSS_CACHE_TTL_MS,
  );
  const parsed = xmlParser.parse(xml)?.rss?.channel;
  const items = toArray<RssItem>(parsed?.item);

  const headlines: NewsHeadline[] = [];
  for (const item of items) {
    if (headlines.length >= HEADLINES_PER_TICKER) break;
    const title = typeof item?.title === 'string' ? item.title : null;
    const link = typeof item?.link === 'string' ? item.link : null;
    if (!title || !link || !item?.pubDate) continue;
    const published = new Date(String(item.pubDate));
    if (Number.isNaN(published.getTime())) continue;

    headlines.push({
      ticker: ourTicker,
      title,
      url: link,
      publishedAt: published.toISOString(),
      sentiment: classifySentiment(title),
    });
  }
  return headlines;
}
