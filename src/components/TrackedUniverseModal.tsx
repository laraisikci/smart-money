import { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { TickerMeta } from '@/types';
import { TICKERS } from '@/data/tickers';
import { EU_TICKER_VENUE, type Venue } from '@/data/tickerVenues';

interface Group {
  id: string;
  label: string;
  note?: string;
  tickers: TickerMeta[];
}

const VENUE_GROUP: Record<Venue, { id: string; label: string; note?: string }> = {
  GER: { id: 'de', label: 'Germany — DAX 40', note: 'German-listed EURO STOXX 50 / DAX constituents' },
  MCE: { id: 'es', label: 'Spain — IBEX 35' },
  PAR: { id: 'fr', label: 'France — CAC 40' },
  AMS: { id: 'nl', label: 'Netherlands — AEX' },
  MIL: { id: 'it', label: 'Italy — EURO STOXX 50 members' },
  BRU: { id: 'be', label: 'Belgium — EURO STOXX 50 members' },
  EBS: { id: 'other', label: 'Other Europe — Switzerland, UK, Denmark', note: 'Not in the five core indices; kept for continuity' },
  LSE: { id: 'other', label: 'Other Europe — Switzerland, UK, Denmark', note: 'Not in the five core indices; kept for continuity' },
  CPH: { id: 'other', label: 'Other Europe — Switzerland, UK, Denmark', note: 'Not in the five core indices; kept for continuity' },
};
const GROUP_ORDER = ['de', 'es', 'fr', 'nl', 'it', 'be', 'other', 'us'];

function buildGroups(): Group[] {
  const map = new Map<string, Group>();
  const add = (id: string, label: string, note: string | undefined, t: TickerMeta) => {
    const g = map.get(id) ?? { id, label, note, tickers: [] };
    g.tickers.push(t);
    map.set(id, g);
  };
  for (const t of TICKERS) {
    if (t.market === 'US') {
      add('us', 'United States — S&P 500 top 100', 'Top 100 S&P 500 companies by market cap', t);
      continue;
    }
    const venue = EU_TICKER_VENUE[t.symbol];
    const g = venue ? VENUE_GROUP[venue] : { id: 'other', label: 'Other Europe — Switzerland, UK, Denmark', note: 'Not in the five core indices; kept for continuity' };
    add(g.id, g.label, g.note, t);
  }
  return GROUP_ORDER.map((id) => map.get(id)).filter((g): g is Group => !!g).map((g) => ({ ...g, tickers: [...g.tickers].sort((a, b) => a.symbol.localeCompare(b.symbol)) }));
}

export function TrackedUniverseModal({ onClose, onSelect }: { onClose: () => void; onSelect: (t: TickerMeta) => void }) {
  const [query, setQuery] = useState('');
  const groups = useMemo(buildGroups, []);
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, tickers: q ? g.tickers.filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)) : g.tickers }))
        .filter((g) => g.tickers.length > 0),
    [groups, q],
  );
  const total = TICKERS.length;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 z-50 flex max-h-[85vh] w-full max-w-md -translate-x-1/2 flex-col rounded-t-3xl border-t border-ink-700 bg-ink-900 lg:top-1/2 lg:bottom-auto lg:max-w-2xl lg:-translate-y-1/2 lg:rounded-3xl lg:border">
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-ink-50">Tracked universe</h3>
            <p className="text-2xs text-ink-500">{total} stocks, grouped by index / primary listing</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by ticker or company"
              className="w-full rounded-lg border border-ink-700 bg-ink-800 py-2 pl-8 pr-3 text-xs text-ink-100 placeholder:text-ink-600"
            />
          </div>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 pb-6">
          {visible.map((g) => (
            <div key={g.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-ink-200">{g.label}</p>
                <span className="font-mono text-2xs text-ink-500">{g.tickers.length}</span>
              </div>
              {g.note && !q && <p className="mb-1.5 text-2xs text-ink-600">{g.note}</p>}
              <div className="flex flex-wrap gap-1.5">
                {g.tickers.map((t) => (
                  <button
                    key={t.symbol}
                    onClick={() => onSelect(t)}
                    title={t.name}
                    className="rounded-lg border border-ink-700/70 bg-ink-800/60 px-2 py-1 text-left transition-colors hover:border-teal-500/40"
                  >
                    <span className="font-mono text-2xs font-bold text-ink-100">{t.symbol}</span>
                    <span className="ml-1.5 text-2xs text-ink-500">{t.name.length > 18 ? `${t.name.slice(0, 17)}…` : t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {visible.length === 0 && <p className="py-8 text-center text-xs text-ink-500">No tracked stock matches "{query}".</p>}
        </div>
      </div>
    </>
  );
}
