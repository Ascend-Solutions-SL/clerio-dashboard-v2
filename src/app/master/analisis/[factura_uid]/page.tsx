'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

import ComparisonFieldRow from '@/components/master/ComparisonFieldRow';
import StatusBadge from '@/components/master/StatusBadge';
import TruncateWithTooltip from '@/components/TruncateWithTooltip';
import { formatValue, type FacturaComparison } from '@/lib/master/facturaComparison';

type PayloadOk = {
  comparison: FacturaComparison;
  status: 'ok' | 'warn' | 'bad';
  summary: string[];
};

type PayloadMissing = {
  factura_uid: string;
  a: unknown | null;
  b: unknown | null;
  missingSide: 'A' | 'B';
};

type Payload = PayloadOk | PayloadMissing | { error?: string };

const TableShell = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{children}</div>
);

export default function MasterAnalisisDetailPage() {
  const params = useParams<{ factura_uid: string }>();
  const factura_uid = useMemo(() => decodeURIComponent(params.factura_uid), [params.factura_uid]);

  const [data, setData] = useState<PayloadOk | PayloadMissing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      const url = new URL('/api/master/analisis/detail', window.location.origin);
      url.searchParams.set('factura_uid', factura_uid);

      const res = await fetch(url.toString(), { credentials: 'include' });
      const payload = (await res.json().catch(() => null)) as Payload | null;

      if (!res.ok || !payload || ('error' in payload && payload.error)) {
        setError((payload as { error?: string } | null)?.error ?? 'No se pudo cargar');
        return;
      }

      setData(payload as PayloadOk | PayloadMissing);
    };

    void load();
  }, [factura_uid]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Detalle Analisis</h1>
          {data && 'comparison' in data && data.comparison.a.drive_file_id ? (
            <a
              href={`https://drive.google.com/file/d/${encodeURIComponent(data.comparison.a.drive_file_id)}/preview`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50"
              aria-label="Abrir vista previa en Drive"
              title="Ver factura"
            >
              <Eye size={18} />
            </a>
          ) : null}
          <p className="mt-1 text-sm text-slate-600">
            Factura UID: <span className="font-mono text-slate-800">{factura_uid}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/master/analisis" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50">
            Volver
          </Link>
          <Link href="/master/analisis/metricas" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50">
            Métricas
          </Link>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      {data && 'comparison' in data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <StatusBadge status={data.status} />
              <div className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{data.comparison.diffCount}</span> diferencias detectadas
              </div>
            </div>
            <div className="text-sm text-slate-600">A = facturas, B = facturas_GAI</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-bold text-slate-900">Herramienta A (facturas)</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-500">Número</div>
                <div className="font-semibold text-slate-900"><TruncateWithTooltip value={data.comparison.a.numero} /></div>
                <div className="text-slate-500">Fecha</div>
                <div className="font-semibold text-slate-900"><TruncateWithTooltip value={String(data.comparison.a.fecha)} /></div>
                <div className="text-slate-500">Tipo</div>
                <div className="font-semibold text-slate-900"><TruncateWithTooltip value={data.comparison.a.tipo} /></div>
                <div className="text-slate-500">Total</div>
                <div className="font-mono text-sm text-slate-900">{formatValue(data.comparison.a.importe_total)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-bold text-slate-900">Herramienta B (facturas_GAI)</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-500">Número</div>
                <div className="font-semibold text-slate-900"><TruncateWithTooltip value={data.comparison.b.numero} /></div>
                <div className="text-slate-500">Fecha</div>
                <div className="font-semibold text-slate-900"><TruncateWithTooltip value={String(data.comparison.b.fecha)} /></div>
                <div className="text-slate-500">Tipo</div>
                <div className="font-semibold text-slate-900"><TruncateWithTooltip value={data.comparison.b.tipo} /></div>
                <div className="text-slate-500">Total</div>
                <div className="font-mono text-sm text-slate-900">{formatValue(data.comparison.b.importe_total)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-bold text-slate-900">Resumen automático</div>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              {data.summary.map((s) => (
                <div key={s}>- {s}</div>
              ))}
            </div>
          </div>

          <TableShell>
            <div className="overflow-x-hidden">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-xs font-semibold text-slate-600">
                    <th className="w-[24%] px-4 py-3">Campo</th>
                    <th className="w-[38%] px-4 py-3">A</th>
                    <th className="w-[38%] px-4 py-3">B</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparison.diffs.map((d) => (
                    <ComparisonFieldRow
                      key={d.field}
                      field={d.field}
                      a={formatValue(d.a)}
                      b={formatValue(d.b)}
                      equal={d.equal}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </TableShell>
        </>
      ) : null}

      {data && !('comparison' in data) ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-bold text-slate-900">No hay pareja completa</div>
          <div className="mt-1 text-sm text-slate-700">Falta el lado: {data.missingSide}</div>
        </div>
      ) : null}
    </div>
  );
}
