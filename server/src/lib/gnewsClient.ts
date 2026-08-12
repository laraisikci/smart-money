import { classifySentiment } from './sentiment.js';
import type { NewsHeadline } from '../types.js';

// GNews's free tier is 100 requests/day, non-commercial use only — nowhere near enough to
// cover the full ~250-ticker universe on any kind of refresh cycle (a single bulk pass would
// blow through it 2.5x over). Scoped to the one place request volume is naturally bounded by
// actual user interaction rather than a bulk scan: fetching news for a single ticker when
// someone opens its detail view. The bulk endpoint powering the Conviction score and card
// badges across all tickers stays on Yahoo's RSS feed (free, no quota) — see newsClient.ts.
const DAILY_LIMIT = 100;
const HEADLINES_PER_REQUEST = 5;

let quotaDate = '';
let quotaUsed = 0;

function quotaAvailable(): boolean {
  const today = new Date().toISOString().slice(0, 10); // GNews resets at 00:00 UTC
  if (today !== quotaDate) {
    quotaDate = today;
    quotaUsed = 0;
  }
  return quotaUsed < DAILY_LIMIT;
}

interface GNewsArticle {
  title?: string;
  url?: string;
  publishedAt?: string;
}
interface GNewsResponse {
  articles?: GNewsArticle[];
}

/**
 * Returns null (not an empty array) whenever GNews isn't usable for any reason — no key
 * configured, quota exhausted, request failed, unexpected response shape — so the caller can
 * tell "GNews genuinely has no news" apart from "fall back to Yahoo" and always do the latter
 * on null.
 */
export async function fetchGNewsHeadlines(ticker: string, query: string): Promise<NewsHeadline[] | null> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return null;
  if (!quotaAvailable()) return null;

  try {
    quotaUsed++;
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=${HEADLINES_PER_REQUEST}&apikey=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return null;

    const data = (await res.json()) as GNewsResponse;
    const headlines: NewsHeadline[] = [];
    for (const article of data.articles ?? []) {
      if (!article.title || !article.url || !article.publishedAt) continue;
      const published = new Date(article.publishedAt);
      if (Number.isNaN(published.getTime())) continue;
      headlines.push({
        ticker,
        title: article.title,
        url: article.url,
        publishedAt: published.toISOString(),
        sentiment: classifySentiment(article.title),
      });
    }
    return headlines;
  } catch {
    return null;
  }
}
