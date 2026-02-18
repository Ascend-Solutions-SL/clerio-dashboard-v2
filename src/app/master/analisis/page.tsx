'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

import TruncateWithTooltip from '@/components/TruncateWithTooltip';

type Row = {
  factura_uid: string;
  totalFields: number;
  percent: number | null;
  reviewedComplete: boolean;
  numero: string;
  fecha: string;
  tipo: string;
  buyer_name: string | null;
  buyer_tax_id: string | null;
  seller_name: string | null;
  seller_tax_id: string | null;
  empresa_id: number | null;
  user_businessname: string | null;
  drive_file_id: string | null;
  importe_total: number | null;
};

const fmtMoney = (v: number | null) => (v === null ? '—' : v.toFixed(2));

type Payload = { rows: Row[]; overallPercent: number | null };

const TableShell = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{children}</div>
);

const fmtPct = (v: number | null) => (v === null ? '—' : `${v.toFixed(0)}%`);

function PctCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="font-mono text-xs text-slate-800">—</span>;
  }

  const isFull = value >= 99.999;
  const text = `${value.toFixed(0)}%`;

  if (!isFull) {
    return <span className="font-mono text-xs text-slate-800">{text}</span>;
  }

  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-800">
      {text}
    </span>
  );
}

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
      reviewed: rows.filter((r) => r.reviewedComplete === true).length,
      perfect: rows.filter((r) => r.reviewedComplete === true && (r.percent ?? 0) >= 99.999).length,
    };
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Analisis (OCR)</h1>
          <p className="mt-1 text-sm text-slate-600">Dashboard de revisión OCR y porcentaje de acierto por factura_uid.</p>
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
            <span>Excluir 100%</span>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-7">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">Total</div>
          <div className="text-lg font-semibold text-slate-900">{counts.total}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">Revisadas</div>
          <div className="text-lg font-semibold text-slate-900">{counts.reviewed}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">100%</div>
          <div className="text-lg font-semibold text-slate-900">{counts.perfect}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">% Acierto global</div>
          <div className="text-lg font-semibold text-slate-900">{fmtPct(data?.overallPercent ?? null)}</div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <TableShell>
        <div className="max-h-[520px] overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="w-[12%] px-4 py-3">Número</th>
                <th className="w-[10%] px-4 py-3">Fecha</th>
                <th className="w-[7%] px-4 py-3">Tipo</th>
                <th className="w-[14%] px-4 py-3">Comprador</th>
                <th className="w-[10%] px-4 py-3">CIF comprador</th>
                <th className="w-[14%] px-4 py-3">Vendedor</th>
                <th className="w-[10%] px-4 py-3">CIF vendedor</th>
                <th className="w-[8%] px-4 py-3">% Acierto</th>
                <th className="w-[9%] px-4 py-3">Total</th>
                <th className="w-[10%] px-4 py-3">Empresa</th>
                <th className="w-[6%] px-4 py-3 text-right">Ver</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((row) => (
                <tr key={row.factura_uid} className="border-t border-slate-100">
                  <td className="w-[12%] px-4 py-3"><TruncateWithTooltip value={row.numero} /></td>
                  <td className="w-[10%] px-4 py-3"><TruncateWithTooltip value={row.fecha} /></td>
                  <td className="w-[7%] px-4 py-3"><TruncateWithTooltip value={row.tipo} /></td>
                  <td className="w-[14%] px-4 py-3"><TruncateWithTooltip value={row.buyer_name ?? ''} /></td>
                  <td className="w-[10%] px-4 py-3"><TruncateWithTooltip value={row.buyer_tax_id ?? ''} /></td>
                  <td className="w-[14%] px-4 py-3"><TruncateWithTooltip value={row.seller_name ?? ''} /></td>
                  <td className="w-[10%] px-4 py-3"><TruncateWithTooltip value={row.seller_tax_id ?? ''} /></td>
                  <td className="w-[8%] px-4 py-3">
                    <PctCell value={row.percent} />
                  </td>
                  <td className="w-[9%] px-4 py-3 font-mono text-xs text-slate-800">{fmtMoney(row.importe_total)}</td>
                  <td className="w-[10%] px-4 py-3"><TruncateWithTooltip value={row.user_businessname ?? ''} /></td>
                  <td className="w-[6%] px-4 py-3 text-right">
                    <Link
                      href={`/master/analisis/${encodeURIComponent(row.factura_uid)}`}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50"
                      aria-label="Ver detalle del análisis"
                    >
                      <Eye size={16} />
                    </Link>
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
