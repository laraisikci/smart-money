import { useMemo, useState } from 'react';
import { Filter, UserCircle2, ExternalLink, Calendar } from 'lucide-react';
import type { NewsHeadline } from '@/types';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getTickerMeta } from '@/data/tickers';
import { formatCurrency, formatShares, timeAgo, daysAgo } from '@/lib/format';
import { ActionBadge, MarketTag, SentimentBadge, LoadingCards, ErrorCard } from '@/components/ui';

const THRESHOLDS = [
  { label: 'Any', value: 0 },
  { label: '$100k+', value: 100_000 },
  { label: '$500k+', value: 500_000 },
  { label: '$1M+', value: 1_000_000 },
];

// null = no cutoff ("Any"). 90 days is the default so stale filings (which shouldn't count
// toward "meaningful recent buys") don't show up unless explicitly asked for.
const DATE_RANGES: { label: string; days: number | null }[] = [
  { label: 'Last 90 days', days: 90 },
  { label: 'Any', days: null },
];
const DEFAULT_DATE_RANGE_DAYS = 90;

function EuropeanDisclosuresCard() {
  const { data } = useApi(api.european);
  if (!data) return null;

  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink-200">European Insider Disclosures</p>
      <p className="mt-1 text-2xs text-ink-500">
        EU insider (PDMR) filings are published as individual notices by each national
        regulator, not a structured feed. Check them directly:
      </p>
      <div className="mt-3 space-y-1.5">
        {data.data.map((r) => (
          <a
            key={r.regulator}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-800/40 px-3 py-2 transition-colors hover:border-ink-600"
          >
            <div>
              <p className="text-xs font-medium text-ink-200">
                {r.regulator} <span className="text-2xs text-ink-500">· {r.country}</span>
              </p>
              <p className="text-2xs text-ink-500">{r.description}</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-500" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function InsidersTab() {
  const [threshold, setThreshold] = useState(100_000);
  const [dateRangeDays, setDateRangeDays] = useState<number | null>(DEFAULT_DATE_RANGE_DAYS);
  const { data, loading, error, refetch } = useApi(api.insiders, 'insiders');
  const newsData = useApi(api.news, 'news');

  const newsByTicker = useMemo(() => {
    const map = new Map<string, NewsHeadline[]>();
    for (const t of newsData.data?.data ?? []) map.set(t.ticker, t.headlines);
    return map;
  }, [newsData.data]);

  const filtered = useMemo(() => {
    const trades = data?.data ?? [];
    return trades
      .filter((t) => t.value >= threshold)
      .filter((t) => dateRangeDays === null || daysAgo(t.filingDate) <= dateRangeDays)
      .sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());
  }, [data, threshold, dateRangeDays]);

  // Distinguishes "nothing in the default 90-day window" from "no trades match your other
  // filters" — the former gets a specific, actionable message rather than a generic empty state.
  const emptyDueToDateRange = filtered.length === 0 && dateRangeDays === DEFAULT_DATE_RANGE_DAYS;

  const activeThreshold = THRESHOLDS.find((t) => t.value === threshold);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <UserCircle2 className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Insider Trades</h2>
      </div>

      <EuropeanDisclosuresCard />

      {/* Date range filter */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-ink-400" />
          <span className="text-xs font-medium text-ink-400">Date range</span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {DATE_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setDateRangeDays(r.days)}
              className={`pill shrink-0 ${
                dateRangeDays === r.days ? 'pill-active' : 'pill-idle'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dollar value filter */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-ink-400" />
          <span className="text-xs font-medium text-ink-400">Min buy size</span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {THRESHOLDS.map((t) => (
            <button
              key={t.value}
              onClick={() => setThreshold(t.value)}
              className={`pill shrink-0 ${
                threshold === t.value ? 'pill-active' : 'pill-idle'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingCards />}
      {error && <ErrorCard message={error} onRetry={refetch} />}

      {data && (
        <>
          <p className="text-xs text-ink-500">
            Showing {filtered.length} trade{filtered.length !== 1 ? 's' : ''}{' '}
            {activeThreshold && activeThreshold.value > 0 && `above ${activeThreshold.label}`}
            {dateRangeDays !== null && ` in the last ${dateRangeDays} days`}
            {' · '}
            <span className="text-ink-600">
              {data.coverage.resolved.length} of {data.coverage.resolved.length + data.coverage.unresolved.length} tracked tickers have SEC filers
            </span>
          </p>

          {/* Trade cards */}
          <div className="space-y-3">
            {filtered.map((trade) => {
          const meta = getTickerMeta(trade.ticker);
          return (
            <div
              key={trade.id}
              className="card animate-fade-in-up p-4 transition-all duration-200 hover:border-ink-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-800">
                    <span className="text-xs font-bold text-ink-300">
                      {trade.insiderName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-ink-50">{trade.ticker}</span>
                      <MarketTag market={trade.market} currency={meta.currency} />
                      <ActionBadge action={trade.transactionType} />
                    </div>
                    <p className="mt-0.5 text-xs text-ink-300">{trade.insiderName}</p>
                    <p className="text-2xs text-ink-500">{trade.insiderTitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-ink-50">
                    {formatCurrency(trade.value)}
                  </div>
                  <p className="text-2xs text-ink-500">{timeAgo(trade.filingDate)}</p>
                </div>
              </div>

              <div className="mt-2">
                <SentimentBadge headlines={newsByTicker.get(trade.ticker) ?? []} />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-ink-700/40 pt-3">
                <div className="flex gap-4">
                  <div>
                    <p className="text-2xs text-ink-500">Shares</p>
                    <p className="font-mono text-xs text-ink-200">{formatShares(trade.shares)}</p>
                  </div>
                  <div>
                    <p className="text-2xs text-ink-500">Price</p>
                    <p className="font-mono text-xs text-ink-200">${trade.price.toFixed(2)}</p>
                  </div>
                </div>
                <span className="text-2xs text-ink-500">{meta.sector}</span>
              </div>
            </div>
              );
            })}
          </div>

          {filtered.length === 0 && emptyDueToDateRange && (
            <div className="py-12 text-center text-sm text-ink-400">
              <p>
                No significant insider buys in the last 90 days above $50k from C-suite
                executives.
              </p>
              <p className="mt-2 text-xs text-ink-500">
                Check back later, or{' '}
                <button
                  onClick={() => setDateRangeDays(null)}
                  className="font-medium text-teal-300 hover:text-teal-200"
                >
                  lower the filter threshold
                </button>{' '}
                to see older filings.
              </p>
            </div>
          )}
          {filtered.length === 0 && !emptyDueToDateRange && (
            <div className="py-12 text-center text-sm text-ink-400">
              No trades match the current filter.
            </div>
          )}
        </>
      )}
    </div>
  );
}
