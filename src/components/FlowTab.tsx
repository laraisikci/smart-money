import { useMemo, useState } from 'react';
import { Waves, ChevronDown, ChevronUp, HelpCircle, Zap } from 'lucide-react';
import type { NewsHeadline, OptionActivity } from '@/types';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { computeConviction } from '@/lib/conviction';
import { smartMoneyDirection } from '@/lib/signalConflict';
import {
  daysToExpiry,
  moneyness,
  estimatedPremium,
  classifyFlowSignal,
  FLOW_SIGNAL_STYLE,
  explainFlowItem,
  computePutCallRatios,
  putCallInterpretation,
  classifyAlignment,
  ALIGNMENT_LABEL,
  type FlowSignal,
} from '@/lib/optionsFlow';
import { SAMPLE_EU_OPTIONS_FLOW } from '@/data/sampleOptionsFlow';
import { LoadingCards, ErrorCard } from '@/components/ui';
import { formatDate } from '@/lib/format';

type FlowFilter = 'ALL' | 'CALLS' | 'PUTS' | 'EU' | 'HIGH_VOLUME';
const FLOW_FILTERS: { label: string; value: FlowFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Calls only', value: 'CALLS' },
  { label: 'Puts only', value: 'PUTS' },
  { label: 'EU only', value: 'EU' },
  { label: 'High volume', value: 'HIGH_VOLUME' },
];
const HIGH_VOLUME_RATIO = 5;

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function HowToReadCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5 text-teal-400" />
          <h4 className="text-xs font-medium uppercase tracking-wider text-ink-400">How to read options flow</h4>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-500" />}
      </button>
      {open && (
        <div className="border-t border-ink-700/40 px-4 pb-4 pt-3">
          <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-ink-300">
            <li>
              <strong className="text-ink-100">Calls</strong> give the buyer the right to buy shares at the strike price —
              bought when someone expects the stock to rise. <strong className="text-ink-100">Puts</strong> give the right to
              sell at the strike — bought for downside protection or a bet the stock falls.
            </li>
            <li>
              <strong className="text-ink-100">Unusual volume</strong> here means today's volume at a strike significantly
              exceeds its existing open interest — most of the activity is new positioning, not existing contracts trading
              hands.
            </li>
            <li>
              A <strong className="text-ink-100">sweep</strong> is a large order executed aggressively across multiple
              exchanges at once, taken as a sign of urgency. Detecting a real sweep needs tick-level, multi-exchange trade
              data that no free source provides — this tab surfaces unusual volume instead, which is a real signal but not
              the same thing.
            </li>
            <li>
              <strong className="text-ink-100">Hedging vs. speculation:</strong> unusual put buying on a stock this app's
              own insider/institutional signals already read as bullish more likely means a large holder protecting an
              existing position than a fresh bearish bet. The same put buying on a stock with no such bullish backing reads
              more speculative.
            </li>
            <li>
              <strong className="text-ink-100">Golden rule:</strong> never act on options flow alone — use it as
              confirmation of other signals (insider buying, institutional filings, technicals), not a standalone reason to
              trade.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function FlowItemCard({ item, signal, convictionScore }: { item: OptionActivity; signal: FlowSignal; convictionScore: number | null }) {
  const [open, setOpen] = useState(false);
  const dte = daysToExpiry(item);
  const { pct, direction } = moneyness(item);
  const premium = estimatedPremium(item);
  const style = FLOW_SIGNAL_STYLE[signal];

  return (
    <div className="card animate-fade-in-up p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-ink-50">{item.ticker}</span>
            {item.sample && <span className="text-sm">🇪🇺</span>}
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold ${
                item.type === 'CALL' ? 'text-bull-400 bg-bull-500/15 border-bull-500/30' : 'text-bear-400 bg-bear-500/15 border-bear-500/30'
              }`}
            >
              {item.type === 'CALL' ? '📈 CALL' : '📉 PUT'}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-400">{item.companyName}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-ink-50">{fmtMoney(premium)}</p>
          <p className="text-2xs text-ink-500">est. premium</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-ink-800/50 p-2.5">
          <p className="text-2xs text-ink-500">Strike vs. price</p>
          <p className="mt-0.5 font-mono text-ink-200">
            {item.currentPrice.toFixed(2)} → {item.strike.toFixed(2)}
          </p>
          <p className="text-2xs text-ink-500">
            {pct.toFixed(0)}% {direction === 'ATM' ? 'at the money' : direction}
          </p>
        </div>
        <div className="rounded-lg bg-ink-800/50 p-2.5">
          <p className="text-2xs text-ink-500">Expiry</p>
          <p className="mt-0.5 font-mono text-ink-200">{formatDate(item.expiry)}</p>
          <p className="text-2xs text-ink-500">
            {dte} day{dte !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-2xs text-ink-500">
        <span>
          Vol <span className="font-mono text-ink-300">{item.volume.toLocaleString()}</span> · OI{' '}
          <span className="font-mono text-ink-300">{item.openInterest.toLocaleString()}</span>
        </span>
        {item.iv !== null && (
          <span>
            IV <span className="font-mono text-ink-300">{(item.iv * 100).toFixed(0)}%</span>
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold ${style.className}`}>
          {style.emoji} {signal}
        </span>
        {convictionScore !== null && (
          <span className="text-2xs text-ink-600">
            conviction <span className="font-mono">{convictionScore}</span>
          </span>
        )}
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-ink-700/60 px-3 py-2 text-left text-2xs font-medium text-teal-300 transition-colors hover:border-ink-600"
      >
        What does this mean?
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && <p className="mt-2 text-xs leading-relaxed text-ink-300">{explainFlowItem(item, signal)}</p>}
    </div>
  );
}

export function FlowTab() {
  const [filter, setFilter] = useState<FlowFilter>('ALL');

  const flowApi = useApi(api.optionsFlow, 'optionsFlow');
  const insiders = useApi(api.insiders, 'insiders');
  const institutions = useApi(api.institutions, 'institutions');
  const polymarket = useApi(api.markets, 'markets');
  const news = useApi(api.news, 'news');

  const newsByTicker = useMemo(() => {
    const map = new Map<string, NewsHeadline[]>();
    for (const t of news.data?.data ?? []) map.set(t.ticker, t.headlines);
    return map;
  }, [news.data]);
  const allHeadlines = useMemo(() => Array.from(newsByTicker.values()).flat(), [newsByTicker]);

  // Same conviction pipeline as ConvictionTab/PulseTab — needed here to disambiguate "possible
  // hedge" from a genuine bearish put bet, and to cross-reference conviction with flow for the
  // alignment section below.
  const convictionResults = useMemo(
    () =>
      computeConviction({
        insiders: insiders.data?.data ?? [],
        institutions: institutions.data?.data ?? [],
        polymarket: polymarket.data?.data ?? [],
        news: allHeadlines,
      }),
    [insiders.data, institutions.data, polymarket.data, allHeadlines],
  );
  const convictionByTicker = useMemo(() => new Map(convictionResults.map((r) => [r.ticker, r])), [convictionResults]);

  const items = useMemo(() => [...(flowApi.data?.data ?? []), ...SAMPLE_EU_OPTIONS_FLOW], [flowApi.data]);

  const filteredItems = useMemo(() => {
    switch (filter) {
      case 'CALLS':
        return items.filter((i) => i.type === 'CALL');
      case 'PUTS':
        return items.filter((i) => i.type === 'PUT');
      case 'EU':
        return items.filter((i) => i.sample);
      case 'HIGH_VOLUME':
        return items.filter((i) => i.volume / Math.max(i.openInterest, 1) >= HIGH_VOLUME_RATIO);
      default:
        return items;
    }
  }, [items, filter]);

  const putCallRatios = useMemo(() => computePutCallRatios(items), [items]);

  const alignmentRows = useMemo(() => {
    const byTicker = new Map<string, { calls: boolean; puts: boolean; companyName: string }>();
    for (const item of items) {
      const entry = byTicker.get(item.ticker) ?? { calls: false, puts: false, companyName: item.companyName };
      if (item.type === 'CALL') entry.calls = true;
      else entry.puts = true;
      byTicker.set(item.ticker, entry);
    }
    const rows: { ticker: string; companyName: string; conviction: number; signal: NonNullable<ReturnType<typeof classifyAlignment>> }[] = [];
    for (const [ticker, { calls, puts, companyName }] of byTicker) {
      const conviction = convictionByTicker.get(ticker)?.totalScore ?? 0;
      const signal = classifyAlignment(conviction, calls, puts);
      if (signal) rows.push({ ticker, companyName, conviction, signal });
    }
    return rows.sort((a, b) => b.conviction - a.conviction);
  }, [items, convictionByTicker]);

  const loading = flowApi.loading;
  const error = flowApi.error;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Waves className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Options Flow</h2>
      </div>

      <HowToReadCard />

      {/* Section 4 — Flow + Conviction alignment */}
      {alignmentRows.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-teal-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Signals aligned</p>
          </div>
          <div className="space-y-2">
            {alignmentRows.map((row) => (
              <div key={row.ticker} className="card flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink-50">{row.ticker}</span>
                  <p className="truncate text-2xs text-ink-500">{row.companyName}</p>
                </div>
                <span className="text-xs font-medium text-ink-200">
                  {ALIGNMENT_LABEL[row.signal].emoji} {ALIGNMENT_LABEL[row.signal].text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {FLOW_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`pill shrink-0 ${filter === f.value ? 'pill-active' : 'pill-idle'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && filteredItems.length === 0 && <LoadingCards />}
      {error && <ErrorCard message={error} onRetry={flowApi.refetch} />}

      {/* Section 1+2 — Unusual Options Activity feed, each with a collapsible explainer */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-400">Unusual Options Activity</p>
        <p className="mb-3 text-2xs text-ink-600">
          US tickers: real, delayed CBOE data — "unusual" means today's volume significantly exceeds existing open interest.
          EU tickers: <span className="font-medium text-warn-400">sample data — EU options data has no free live source</span>
          , shown to demonstrate the concept.
        </p>
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {filteredItems.map((item, i) => {
            const conviction = convictionByTicker.get(item.ticker);
            const smartMoney = conviction ? smartMoneyDirection(conviction) : null;
            const signal = classifyFlowSignal(item, smartMoney);
            return (
              <FlowItemCard
                key={`${item.ticker}-${item.type}-${item.strike}-${item.expiry}-${i}`}
                item={item}
                signal={signal}
                convictionScore={convictionByTicker.get(item.ticker)?.totalScore ?? null}
              />
            );
          })}
        </div>
        {!loading && filteredItems.length === 0 && (
          <div className="py-12 text-center text-sm text-ink-400">No unusual activity matches this filter right now.</div>
        )}
      </div>

      {/* Section 3 — Put/Call ratio per stock */}
      {putCallRatios.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-400">Put/Call Ratio</p>
          <p className="mb-3 text-2xs text-ink-600">Based on today's flagged unusual activity above, not total daily volume.</p>
          <div className="space-y-2">
            {putCallRatios.map((r) => {
              const interp = putCallInterpretation(r.ratio);
              return (
                <div key={r.ticker} className="card flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-ink-50">{r.ticker}</span>
                    {r.sample && <span className="text-sm">🇪🇺</span>}
                    <p className="truncate text-2xs text-ink-500">{r.companyName}</p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="font-mono text-sm text-ink-200">{Number.isFinite(r.ratio) ? r.ratio.toFixed(2) : '∞'}</span>
                    <span className="text-2xs text-ink-400">
                      {interp.emoji} {interp.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
