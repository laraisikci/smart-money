import { Landmark, ExternalLink, AlertCircle, Percent } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { LoadingCards, ErrorCard } from '@/components/ui';

const FLAGS: Record<string, string> = {
  Spain: '🇪🇸',
  France: '🇫🇷',
  Germany: '🇩🇪',
  'United Kingdom': '🇬🇧',
  Italy: '🇮🇹',
};

export function ParliamentTab() {
  const eu = useApi(api.european);
  const congress = useApi(api.congress);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-teal-400" />
        <h2 className="text-lg font-semibold text-ink-50">Regulatory Filings</h2>
      </div>

      {/* EU regulator links */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-400">
          European Disclosures
        </p>
        {eu.loading && <LoadingCards count={4} />}
        {eu.error && <ErrorCard message={eu.error} onRetry={eu.refetch} />}
        {eu.data && (
          <div className="space-y-3">
            {eu.data.data.map((r) => (
              <a
                key={r.regulator}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="card flex animate-fade-in-up items-start justify-between gap-3 p-4 transition-all duration-200 hover:border-ink-600"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none">{FLAGS[r.country] ?? '🇪🇺'}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink-50">{r.regulator}</span>
                      <span className="text-2xs text-ink-500">{r.country}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-400">{r.description}</p>
                  </div>
                </div>
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Major shareholder notifications — real disclosure regime, no structured feed exists */}
      <div>
        <div className="mb-3 flex items-center gap-1.5">
          <Percent className="h-3.5 w-3.5 text-teal-400" />
          <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Major Shareholder Notifications
          </p>
        </div>
        {eu.data && (
          <>
            <p className="mb-3 text-2xs text-ink-500">{eu.data.majorHoldingsNote}</p>
            <div className="space-y-3">
              {eu.data.majorHoldings.map((r) => (
                <a
                  key={r.regulator}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="card flex animate-fade-in-up items-start justify-between gap-3 p-4 transition-all duration-200 hover:border-ink-600"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl leading-none">{FLAGS[r.country] ?? '🇪🇺'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink-50">{r.regulator}</span>
                        <span className="text-2xs text-ink-500">{r.country}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-400">{r.description}</p>
                    </div>
                  </div>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
                </a>
              ))}
            </div>
          </>
        )}
      </div>

      {/* US Congress: unavailable */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-400">
          US Congress
        </p>
        {congress.loading && <LoadingCards count={1} />}
        {congress.data && (
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 text-warn-400" />
              <div>
                <p className="text-xs font-medium text-warn-300">
                  Congressional trade data sources are currently unavailable
                </p>
                <p className="mt-1 text-2xs text-ink-500">{congress.data.reason}</p>
                <p className="mt-1 text-2xs text-ink-600">
                  We're monitoring for a reliable free source.
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-ink-700/40 pt-3">
              <p className="text-2xs font-medium text-ink-400">Check official filings directly</p>
              {congress.data.officialSources.map((src) => (
                <a
                  key={src.url}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-800/40 px-3 py-2 transition-colors hover:border-ink-600"
                >
                  <span className="text-xs text-ink-200">{src.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
