'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import TruncateWithTooltip from '@/components/TruncateWithTooltip';

type FieldMetric = {
  field: string;
  correct: number;
  incorrect: number;
  unset: number;
  total: number;
  reviewed: number;
  coveragePct: number;
  accuracyPct: number;
};

type Totals = {
  totalFacturas: number;
  withReview: number;
  completeReviews: number;
  perfect: number;
  overallAccuracyPct: number | null;
};

type Payload = { totals: Totals; fields: FieldMetric[] };

const TableShell = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{children}</div>
);

export default function MasterAnalisisMetricasPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      const res = await fetch('/api/master/analisis/metrics', { credentials: 'include' });
      const payload = (await res.json().catch(() => null)) as Payload | { error?: string } | null;
      if (!res.ok || !payload || 'error' in payload) {
        setError((payload as { error?: string } | null)?.error ?? 'No se pudo cargar');
        return;
      }
      setData(payload as Payload);
    };

    void load();
  }, []);

  const topWorst = useMemo(() => {
    return [...(data?.fields ?? [])].sort((a, b) => a.accuracyPct - b.accuracyPct).slice(0, 6);
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Métricas de coincidencia</h1>
          <p className="mt-1 text-sm text-slate-600">Cobertura de revisión y precisión por campo (OCR).</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/master/analisis" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50">
            Volver
          </Link>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Facturas</div>
              <div className="text-lg font-semibold text-slate-900">{data.totals.totalFacturas}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Con revisión</div>
              <div className="text-lg font-semibold text-slate-900">{data.totals.withReview}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Revisión completa</div>
              <div className="text-lg font-semibold text-slate-900">{data.totals.completeReviews}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-xs text-emerald-700">100%</div>
              <div className="text-lg font-semibold text-emerald-900">{data.totals.perfect}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-500">Precisión global (campos revisados)</div>
            <div className="text-lg font-semibold text-slate-900">
              {data.totals.overallAccuracyPct === null ? '—' : `${data.totals.overallAccuracyPct.toFixed(1)}%`}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-bold text-slate-900">Campos con menor precisión</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {topWorst.map((f) => (
                <div key={f.field} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 text-sm font-semibold text-slate-900">
                      <TruncateWithTooltip value={f.field} />
                    </div>
                    <div className="font-mono text-xs text-slate-700">{f.accuracyPct.toFixed(0)}%</div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${Math.min(100, Math.max(0, f.accuracyPct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <TableShell>
            <div className="max-h-[620px] overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-xs font-semibold text-slate-600">
                    <th className="w-[28%] px-4 py-3">Campo</th>
                    <th className="w-[14%] px-4 py-3">Precisión</th>
                    <th className="w-[14%] px-4 py-3">Cobertura</th>
                    <th className="w-[14%] px-4 py-3">Correcto</th>
                    <th className="w-[14%] px-4 py-3">Incorrecto</th>
                    <th className="w-[16%] px-4 py-3">Sin revisar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fields.map((f) => (
                    <tr key={f.field} className="border-t border-slate-100">
                      <td className="w-[28%] px-4 py-3"><TruncateWithTooltip value={f.field} /></td>
                      <td className="w-[14%] px-4 py-3 font-mono text-xs text-slate-800">{f.accuracyPct.toFixed(1)}%</td>
                      <td className="w-[14%] px-4 py-3 font-mono text-xs text-slate-800">{f.coveragePct.toFixed(1)}%</td>
                      <td className="w-[14%] px-4 py-3 font-mono text-xs text-slate-800">{f.correct}</td>
                      <td className="w-[14%] px-4 py-3 font-mono text-xs text-slate-800">{f.incorrect}</td>
                      <td className="w-[16%] px-4 py-3 font-mono text-xs text-slate-800">{f.unset}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableShell>
        </>
      ) : null}
    </div>
  );
}
