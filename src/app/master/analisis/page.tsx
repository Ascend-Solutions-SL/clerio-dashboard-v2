'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

import TruncateWithTooltip from '@/components/TruncateWithTooltip';
import StatusBadge from '@/components/master/StatusBadge';

type Row = {
  factura_uid: string;
  status: 'ok' | 'warn' | 'bad' | 'missing';
  diffCount: number;
  numero: string;
  fecha: string;
  tipo: string;
  empresa_id: number | null;
  user_businessname: string | null;
  drive_file_id: string | null;
  importe_total_a: number | null;
  importe_total_b: number | null;
  delta_importe_total: number | null;
  missingSide?: 'A' | 'B';
};

type Payload = { rows: Row[] };

const TableShell = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{children}</div>
);

const fmtMoney = (v: number | null) => (v === null ? '' : v.toFixed(2));

export default function MasterAnalisisPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [onlyDiffs, setOnlyDiffs] = useState(false);

  useEffect(() => {
    const load = async () => {
      setError(null);
      const url = new URL('/api/master/analisis/list', window.location.origin);
      if (onlyDiffs) {
        url.searchParams.set('onlyDiffs', '1');
      }
      if (q.trim()) {
        url.searchParams.set('q', q.trim());
      }

      const res = await fetch(url.toString(), { credentials: 'include' });
      const payload = (await res.json().catch(() => null)) as Payload | { error?: string } | null;
      if (!res.ok || !payload || 'error' in payload) {
        setError((payload as { error?: string } | null)?.error ?? 'No se pudo cargar');
        return;
      }
      setData(payload as Payload);
    };

    void load();
  }, [onlyDiffs, q]);

  const counts = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      total: rows.length,
      ok: rows.filter((r) => r.status === 'ok').length,
      warn: rows.filter((r) => r.status === 'warn').length,
      bad: rows.filter((r) => r.status === 'bad').length,
      missing: rows.filter((r) => r.status === 'missing').length,
    };
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Analisis (Facturas vs Facturas_GAI)</h1>
          <p className="mt-1 text-sm text-slate-600">Dashboard comparativo para evaluar coincidencias y discrepancias por factura_uid.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyDiffs((v) => !v)}
            aria-pressed={onlyDiffs}
            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold shadow-sm transition ${
              onlyDiffs
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className={`relative h-5 w-9 rounded-full transition ${onlyDiffs ? 'bg-white/25' : 'bg-slate-200'}`}>
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                  onlyDiffs ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
            <span>Excluir OK</span>
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (uid, numero, empresa, tipo, fecha...)"
            className="w-full max-w-[320px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          />
          <Link
            href="/master/analisis/metricas"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Ver métricas
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">Total</div>
          <div className="text-lg font-semibold text-slate-900">{counts.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-xs text-emerald-700">OK</div>
          <div className="text-lg font-semibold text-emerald-900">{counts.ok}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-xs text-amber-700">Revisar</div>
          <div className="text-lg font-semibold text-amber-900">{counts.warn}</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-xs text-red-700">Error</div>
          <div className="text-lg font-semibold text-red-900">{counts.bad}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs text-slate-600">Falta lado</div>
          <div className="text-lg font-semibold text-slate-900">{counts.missing}</div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <TableShell>
        <div className="max-h-[520px] overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="w-[9%] px-4 py-3">Estado</th>
                <th className="w-[8%] px-4 py-3">Diffs</th>
                <th className="w-[18%] px-4 py-3">Factura UID</th>
                <th className="w-[10%] px-4 py-3">Número</th>
                <th className="w-[9%] px-4 py-3">Fecha</th>
                <th className="w-[9%] px-4 py-3">Tipo</th>
                <th className="w-[14%] px-4 py-3">Empresa</th>
                <th className="w-[17%] px-4 py-3">Importe total (A / B)</th>
                <th className="w-[6%] px-4 py-3 text-right">Ver</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((row) => (
                <tr key={row.factura_uid} className="border-t border-slate-100">
                  <td className="w-[9%] px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="w-[8%] px-4 py-3 font-mono text-xs text-slate-800">{row.diffCount}</td>
                  <td className="w-[18%] px-4 py-3">
                    <Link href={`/master/analisis/${encodeURIComponent(row.factura_uid)}`} className="font-semibold text-slate-900 hover:underline">
                      <TruncateWithTooltip value={row.factura_uid} />
                    </Link>
                  </td>
                  <td className="w-[10%] px-4 py-3"><TruncateWithTooltip value={row.numero} /></td>
                  <td className="w-[9%] px-4 py-3"><TruncateWithTooltip value={row.fecha} /></td>
                  <td className="w-[9%] px-4 py-3"><TruncateWithTooltip value={row.tipo} /></td>
                  <td className="w-[14%] px-4 py-3"><TruncateWithTooltip value={row.user_businessname ?? ''} /></td>
                  <td className="w-[17%] px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-slate-800">{fmtMoney(row.importe_total_a)} / {fmtMoney(row.importe_total_b)}</span>
                      {row.delta_importe_total !== null ? (
                        <span className={`font-mono text-xs ${Math.abs(row.delta_importe_total) < 0.005 ? 'text-slate-500' : row.delta_importe_total > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                          Δ {row.delta_importe_total.toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="w-[6%] px-4 py-3 text-right">
                    {row.drive_file_id ? (
                      <a
                        href={`https://drive.google.com/file/d/${encodeURIComponent(row.drive_file_id)}/preview`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50"
                        aria-label="Abrir vista previa en Drive"
                      >
                        <Eye size={16} />
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableShell>
    </div>
  );
}
