import { useEffect, useState, useCallback } from 'react';
import { reportFreshnessLoading, reportFreshnessSuccess, reportFreshnessError } from '@/lib/dataFreshness';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function extractGeneratedAt(data: unknown): string | null {
  if (data && typeof data === 'object' && 'generatedAt' in data) {
    const value = (data as { generatedAt: unknown }).generatedAt;
    return typeof value === 'string' ? value : null;
  }
  return null;
}

// `source` is optional and purely for the header's data-freshness indicator (see
// lib/dataFreshness.ts) — passing it reports real fetch outcomes into that shared store. Omit
// it for endpoints that indicator doesn't track (european, congress).
export function useApi<T>(fetcher: () => Promise<T>, source?: string): ApiState<T> {
  const [state, setState] = useState<Omit<ApiState<T>, 'refetch'>>({
    data: null,
    loading: true,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    if (source) reportFreshnessLoading(source);
    fetcher()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null });
          if (source) reportFreshnessSuccess(source, extractGeneratedAt(data));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setState({ data: null, loading: false, error: message });
          if (source) reportFreshnessError(source, message);
        }
      });
    return () => {
      cancelled = true;
    };
    // fetcher is expected to be referentially stable per call site (e.g. api.insiders)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, source]);

  const refetch = useCallback(() => setAttempt((a) => a + 1), []);

  return { ...state, refetch };
}
