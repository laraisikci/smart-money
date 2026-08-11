import { useState } from 'react';
import { useFreshnessSnapshot } from '@/lib/dataFreshness';

const TRACKED_SOURCES = ['insiders', 'institutions', 'markets'] as const;
const SOURCE_LABELS: Record<(typeof TRACKED_SOURCES)[number], string> = {
  insiders: 'Insiders',
  institutions: 'Institutions',
  markets: 'Markets',
};

function timeAgoShort(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Replaces what used to be a hardcoded "Live" badge with one driven by real fetch outcomes —
// useApi() reports into the shared freshness store whenever a tracked source succeeds or fails,
// and this just reflects that. A source shows "not loaded yet" until its tab has actually been
// visited this session, which is honest: we don't know its freshness before that.
export function DataStatus() {
  const [open, setOpen] = useState(false);
  const entries = useFreshnessSnapshot();
  const bySource = Object.fromEntries(entries.map((e) => [e.source, e]));

  const relevant = TRACKED_SOURCES.map((s) => bySource[s]).filter(Boolean);
  const anyLoading = relevant.some((e) => e.loading);
  const anyError = relevant.some((e) => e.lastError);
  const anySuccess = relevant.some((e) => e.lastSuccessAt);

  let label = 'No data yet';
  let dotClass = 'bg-ink-500';
  if (anyLoading && !anySuccess) {
    label = 'Loading';
    dotClass = 'animate-pulse-soft bg-ink-400';
  } else if (anySuccess && !anyError) {
    label = 'Live';
    dotClass = 'animate-pulse-soft bg-bull-400';
  } else if (anySuccess && anyError) {
    label = 'Partial';
    dotClass = 'bg-warn-400';
  } else if (anyError) {
    label = 'Offline';
    dotClass = 'bg-bear-400';
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full px-1.5 py-1 transition-colors hover:bg-ink-800/60"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        <span className="text-2xs text-ink-400">{label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-ink-700/60 bg-ink-900 p-3 shadow-lg">
            <p className="mb-2 text-2xs font-medium uppercase tracking-wider text-ink-500">
              Data sources
            </p>
            <div className="space-y-2">
              {TRACKED_SOURCES.map((s) => {
                const e = bySource[s];
                const dot = !e
                  ? 'bg-ink-600'
                  : e.loading
                    ? 'animate-pulse-soft bg-ink-400'
                    : e.lastSuccessAt
                      ? e.lastError
                        ? 'bg-warn-400'
                        : 'bg-bull-400'
                      : 'bg-bear-400';
                const text = !e
                  ? 'not loaded yet'
                  : e.loading
                    ? 'loading…'
                    : e.lastSuccessAt
                      ? timeAgoShort(e.lastSuccessAt)
                      : 'error';
                return (
                  <div key={s} className="flex items-center justify-between text-2xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                      <span className="text-ink-300">{SOURCE_LABELS[s]}</span>
                    </div>
                    <span className="text-ink-500">{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
