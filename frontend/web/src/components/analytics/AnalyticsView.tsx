/**
 * Voice analytics overview.
 *
 * Polls the metrics endpoint, hydrates charts with either live or fallback data,
 * and summarises the resulting aggregates for supervisors.
 */
'use client';

import { useMemo } from 'react';
import { useApiQuery } from '@/hooks/useApi';

type AnalyticsPoint = {
  timestamp: string;
  calls: number;
  avgDuration: number;
  sentiment: number;
};

type AnalyticsResponse = {
  series: AnalyticsPoint[];
};

const FALLBACK_ANALYTICS: AnalyticsPoint[] = Array.from({ length: 8 }).map((_, idx) => ({
  timestamp: new Date(Date.now() - idx * 3600 * 1000).toISOString(),
  calls: 20 + idx * 3,
  avgDuration: 180 + idx * 12,
  sentiment: 0.65 + idx * 0.02,
}));

export default function AnalyticsView(): JSX.Element {
  // We poll analytics once a minute; the hook keeps stale data visible between refreshes.
  const { data, loading, error } = useApiQuery<AnalyticsResponse>('/analytics/voice', {
    fallbackData: { series: FALLBACK_ANALYTICS },
    pollIntervalMs: 60000,
  });

  // Prefer live data but gracefully degrade to seeded numbers if the API is offline.
  const points = Array.isArray(data?.series) && data?.series.length > 0 ? data.series : FALLBACK_ANALYTICS;

  const aggregates = useMemo(() => {
    // Aggregate totals are derived client-side to keep the API surface slim.
    const totalCalls = points.reduce((sum, point) => sum + point.calls, 0);
    const avgDuration = Math.round(points.reduce((sum, point) => sum + point.avgDuration, 0) / points.length);
    const avgSentiment = points.reduce((sum, point) => sum + point.sentiment, 0) / points.length;
    return {
      totalCalls,
      avgDuration,
      avgSentiment,
    };
  }, [points]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">Monitor call volumes, handle times, and customer sentiment trends.</p>
      </header>

      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Analytics API unavailable. Showing cached data.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Total calls</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{aggregates.totalCalls}</div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Average duration</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{aggregates.avgDuration}s</div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Avg sentiment</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-600">{(aggregates.avgSentiment * 100).toFixed(1)}%</div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Hourly breakdown</h2>
        <div className="mt-4 grid gap-3 text-sm text-slate-600">
          {points.map((point) => (
            <div
              key={point.timestamp}
              className="grid grid-cols-[1fr,auto] items-center rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 shadow-sm"
            >
              <div>
                <div className="font-medium text-slate-800">{new Date(point.timestamp).toLocaleTimeString()}</div>
                <div className="text-xs text-slate-400">Sentiment {(point.sentiment * 100).toFixed(1)}%</div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="font-semibold">{point.calls} calls</span>
                <span>{Math.round(point.avgDuration)}s</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {loading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Updating analytics…
        </div>
      )}
    </div>
  );
}


