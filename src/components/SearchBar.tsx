import { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { SearchResult } from '@/types';
import { api } from '@/lib/api';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function SearchBar({ onSelect }: { onSelect: (result: SearchResult) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    let cancelled = false;
    const handle = setTimeout(() => {
      api
        .search(trimmed)
        .then((res) => {
          if (cancelled) return;
          setResults(res.data);
          setOpen(true);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const handleSelect = (r: SearchResult) => {
    onSelect(r);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const showDropdown = open && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search any stock — ticker or company name"
          className="w-full rounded-xl border border-ink-700 bg-ink-800/60 py-2.5 pl-9 pr-9 text-sm text-ink-100 placeholder:text-ink-500 transition-colors focus:border-teal-500/50 focus:outline-none"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-500" />
        )}
      </div>

      {showDropdown && (
        <div className="card absolute z-30 mt-1.5 max-h-80 w-full overflow-y-auto p-1.5 shadow-lg">
          {loading && results.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-ink-500">Searching…</p>
          )}
          {!loading && error && (
            <p className="px-3 py-2.5 text-xs text-bear-400">Search failed — try again.</p>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-ink-500">No matches for "{query.trim()}"</p>
          )}
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => handleSelect(r)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-ink-800/60"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-ink-50">{r.symbol}</span>
                  {r.tracked && (
                    <span className="rounded-full bg-teal-400/15 px-1.5 py-0.5 text-2xs font-medium text-teal-300">
                      Tracked
                    </span>
                  )}
                </div>
                <p className="truncate text-2xs text-ink-400">{r.name}</p>
              </div>
              <span className="shrink-0 text-2xs text-ink-500">
                {r.market === 'US' ? 'US' : r.exchange}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
