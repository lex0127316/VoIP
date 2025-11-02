'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSession } from '@/hooks/useSession';
import { useApiQuery } from '@/hooks/useApi';

type Metrics = {
  activeCalls: number;
  concurrentCapacity: number;
  avgHandleTime: number;
  serviceLevel: number;
  abandonedRate: number;
};

const FALLBACK_METRICS: Metrics = {
  activeCalls: 0,
  concurrentCapacity: 50,
  avgHandleTime: 312,
  serviceLevel: 0.94,
  abandonedRate: 0.03,
};

export default function DashboardView(): JSX.Element {
  const { session, status } = useSession();

  const { data: metrics, loading: metricsLoading, error: metricsError } = useApiQuery<Metrics>('/metrics/overview', {
    fallbackData: FALLBACK_METRICS,
    pollIntervalMs: 15000,
    transform: (raw) => {
      const source = raw as Record<string, unknown> | undefined;
      if (!source) {
        return FALLBACK_METRICS;
      }
      return {
        activeCalls: Number(source.activeCalls ?? source.active_calls ?? FALLBACK_METRICS.activeCalls),
        concurrentCapacity: Number(
          source.concurrentCapacity ?? source.concurrent_capacity ?? FALLBACK_METRICS.concurrentCapacity,
        ),
        avgHandleTime: Number(source.avgHandleTime ?? source.avg_handle_time ?? FALLBACK_METRICS.avgHandleTime),
        serviceLevel: Number(source.serviceLevel ?? source.service_level ?? FALLBACK_METRICS.serviceLevel),
        abandonedRate: Number(source.abandonedRate ?? source.abandoned_rate ?? FALLBACK_METRICS.abandonedRate),
      } satisfies Metrics;
    },
  });

  const { data: health } = useApiQuery<{ status?: string }>('/health', {
    fallbackData: { status: 'unknown' },
    pollIntervalMs: 30000,
  });

  const availability = useMemo(() => {
    const value = metrics?.serviceLevel ?? FALLBACK_METRICS.serviceLevel;
    return `${Math.round(value * 100)}%`;
  }, [metrics]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {session?.userId ?? 'operator'}</h1>
          <p className="text-sm text-slate-500">
            Tenant <span className="font-medium">{session?.tenantId ?? 'n/a'}</span> · Session {status}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/softphone"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            Open softphone
          </Link>
          <Link
            href="/callflow-builder"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
          >
            Design callflow
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Active calls</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{metrics?.activeCalls ?? FALLBACK_METRICS.activeCalls}</div>
          <span className="text-xs text-slate-400">API health: {health?.status ?? 'unknown'}</span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Concurrent capacity</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {metrics?.concurrentCapacity ?? FALLBACK_METRICS.concurrentCapacity}
          </div>
          <span className="text-xs text-slate-400">Slots remaining {(metrics?.concurrentCapacity ?? 0) - (metrics?.activeCalls ?? 0)}</span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Average handle time</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {Math.round(metrics?.avgHandleTime ?? FALLBACK_METRICS.avgHandleTime)}s
          </div>
          <span className="text-xs text-slate-400">Measured over last hour</span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Service level</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-600">{availability}</div>
          <span className="text-xs text-slate-400">Abandonment {(metrics?.abandonedRate ?? FALLBACK_METRICS.abandonedRate) * 100}%</span>
        </article>
      </section>

      {metricsError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Metrics service unreachable. Showing cached values.
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Live queues</h2>
          <p className="text-sm text-slate-500">Monitor queue depth and SLA adherence in real time.</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-slate-500">Priority queue</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">4 waiting</dd>
              <span className="text-xs text-slate-400">Longest wait 01:12</span>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-slate-500">Standard queue</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">12 waiting</dd>
              <span className="text-xs text-slate-400">Longest wait 02:48</span>
            </div>
          </dl>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">Agent Harper</span> closed ticket #43921 · 3m ago
            </li>
            <li className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">SIP trunk</span> registered new endpoint (atl-03)
            </li>
            <li className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">Media relay</span> scaled to 5 instances after load alert
            </li>
          </ul>
        </article>
      </section>

      {metricsLoading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Refreshing metrics…
        </div>
      )}
    </div>
  );
}


