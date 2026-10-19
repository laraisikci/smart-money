import { useState } from 'react';
import { X, Copy, Check, Link2, Download, Upload } from 'lucide-react';
import type { WatchlistEntry } from '@/types';
import { buildShareUrl, exportWatchlistText, importWatchlistText, type ImportResult } from '@/lib/watchlist';

export type ShareTab = 'share' | 'export' | 'import';

const TAB_LABEL: Record<ShareTab, string> = { share: 'Share link', export: 'Export', import: 'Import' };

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2000);
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400/15 px-3 py-1.5 text-xs font-semibold text-teal-300 transition-colors hover:bg-teal-400/25"
    >
      {state === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select & copy manually' : 'Copy'}
    </button>
  );
}

export function WatchlistShareModal({
  entries,
  initialTab,
  onClose,
  onImported,
}: {
  entries: WatchlistEntry[];
  initialTab: ShareTab;
  onClose: () => void;
  onImported: () => void;
}) {
  const [tab, setTab] = useState<ShareTab>(initialTab);
  const [importText, setImportText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const shareUrl = buildShareUrl(entries);
  const exportText = exportWatchlistText(entries);

  function runImport() {
    const r = importWatchlistText(importText);
    setResult(r);
    if (r.added.length > 0) onImported();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-50">Share Watchlist</h3>
          <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-ink-400 hover:text-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          {(Object.keys(TAB_LABEL) as ShareTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`pill shrink-0 ${tab === t ? 'pill-active' : 'pill-idle'}`}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {tab === 'share' && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-ink-300">Copy this link to give Claude or anyone else a view of your watchlist.</p>
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 font-mono text-2xs text-ink-200"
            />
            <div className="flex items-center gap-2">
              <CopyButton text={shareUrl} />
              <Link2 className="h-3.5 w-3.5 text-ink-600" />
            </div>
            <ul className="list-disc space-y-1 pl-4 text-2xs leading-relaxed text-ink-500">
              <li>The link always reflects your current watchlist — it's kept in sync as you add and remove stocks.</li>
              <li>Opening it in a browser with an empty watchlist imports those tickers. A browser that already has its own watchlist keeps it.</li>
              <li>
                Only stocks in the tracked universe travel in the link; stocks added via search are not included. This is a
                web app, so a tool that only downloads the page without running its JavaScript won't see the list — give it
                the <strong className="text-ink-300">Export</strong> text instead.
              </li>
            </ul>
          </div>
        )}

        {tab === 'export' && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-ink-300">Plain text, one ticker per line.</p>
            <textarea
              readOnly
              value={exportText}
              onFocus={(e) => e.currentTarget.select()}
              rows={Math.min(10, Math.max(3, entries.length))}
              placeholder="Your watchlist is empty."
              className="w-full resize-none rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 font-mono text-xs text-ink-200"
            />
            <div className="flex items-center gap-2">
              <CopyButton text={exportText} />
              <Download className="h-3.5 w-3.5 text-ink-600" />
            </div>
          </div>
        )}

        {tab === 'import' && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-ink-300">Paste tickers — one per line, or comma-separated (e.g. ASML, ITX.MC, SAP).</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={5}
              placeholder={'ASML\nITX.MC\nSAP'}
              className="w-full resize-none rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 font-mono text-xs text-ink-200 placeholder:text-ink-600"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={runImport}
                disabled={!importText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400/15 px-3 py-1.5 text-xs font-semibold text-teal-300 transition-colors hover:bg-teal-400/25 disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" /> Add to watchlist
              </button>
            </div>
            {result && (
              <div className="space-y-1 text-2xs text-ink-400">
                {result.added.length > 0 && <p className="text-bull-400">Added {result.added.length}: {result.added.join(', ')}</p>}
                {result.alreadyOnList.length > 0 && <p>Already on your list: {result.alreadyOnList.join(', ')}</p>}
                {result.notFound.length > 0 && (
                  <p className="text-warn-300">Not in the tracked universe (skipped): {result.notFound.join(', ')}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
