// Daily conviction scores, one entry per stock per day, kept for 30 days in localStorage — so
// "7-day change" and the sparkline come from scores this app actually computed, not estimates.
// The honest consequence: history starts the day this shipped. Until a stock has an entry at
// least 7 (or 30) days old, that change simply isn't available (null), rather than faked.
const STORAGE_KEY = 'smart-money.score-history.v1';
const KEEP_DAYS = 30;

interface StockHistory {
  first: string; // YYYY-MM-DD this stock was first recorded with any signal
  days: Record<string, number>; // YYYY-MM-DD -> final (capped) conviction score that day
}
interface Store {
  trackingStarted: string;
  stocks: Record<string, StockHistory>;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  return isoDay(new Date());
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);
}

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed && typeof parsed === 'object' && parsed.stocks) return parsed;
    }
  } catch {
    // fall through to a fresh store
  }
  return { trackingStarted: todayIso(), stocks: {} };
}

function write(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage unavailable (private browsing, quota) — history just won't persist
  }
}

// Idempotent within a day: re-recording overwrites today's entry with the latest score.
export function recordScores(results: { ticker: string; totalScore: number }[]): void {
  if (results.length === 0) return;
  const store = read();
  const today = todayIso();
  for (const { ticker, totalScore } of results) {
    const entry = store.stocks[ticker] ?? { first: today, days: {} };
    entry.days[today] = totalScore;
    // prune to the last KEEP_DAYS days
    for (const day of Object.keys(entry.days)) {
      if (daysBetween(day, today) >= KEEP_DAYS) delete entry.days[day];
    }
    store.stocks[ticker] = entry;
  }
  write(store);
}

export interface ScoreHistoryInfo {
  firstFlagged: string; // YYYY-MM-DD
  // true when "first flagged" is simply the day tracking began for this browser, i.e. the stock
  // may well have been flagged earlier — we just weren't recording yet.
  trackingStartedHere: boolean;
  change7d: number | null;
  change30d: number | null;
  series: { date: string; score: number }[]; // oldest -> newest, up to 30 days
}

// Score change vs. the most recent entry dated at least `days` ago (null if we have none that
// old yet) — never extrapolated from a shorter window.
function changeOver(entry: StockHistory, days: number, current: number): number | null {
  const today = todayIso();
  const candidates = Object.keys(entry.days)
    .filter((d) => daysBetween(d, today) >= days)
    .sort();
  if (candidates.length === 0) return null;
  return current - entry.days[candidates[candidates.length - 1]];
}

export function getHistoryInfo(ticker: string, currentScore: number): ScoreHistoryInfo | null {
  const store = read();
  const entry = store.stocks[ticker];
  if (!entry) return null;
  const series = Object.keys(entry.days)
    .sort()
    .map((date) => ({ date, score: entry.days[date] }));
  return {
    firstFlagged: entry.first,
    trackingStartedHere: entry.first === store.trackingStarted,
    change7d: changeOver(entry, 7, currentScore),
    change30d: changeOver(entry, 29, currentScore), // 30 days of history = entries up to 29 days back
    series,
  };
}

export function getAllHistoryInfo(results: { ticker: string; totalScore: number }[]): Map<string, ScoreHistoryInfo> {
  const store = read();
  const out = new Map<string, ScoreHistoryInfo>();
  for (const { ticker, totalScore } of results) {
    const entry = store.stocks[ticker];
    if (!entry) continue;
    const series = Object.keys(entry.days)
      .sort()
      .map((date) => ({ date, score: entry.days[date] }));
    out.set(ticker, {
      firstFlagged: entry.first,
      trackingStartedHere: entry.first === store.trackingStarted,
      change7d: changeOver(entry, 7, totalScore),
      change30d: changeOver(entry, 29, totalScore),
      series,
    });
  }
  return out;
}
