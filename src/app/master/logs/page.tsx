'use client';

import { useEffect, useState } from 'react';

type LogRow = {
  id: number;
  created_at: string;
  log: string | null;
};

type Payload = { logs: LogRow[]; page: number; limit: number; hasMore: boolean };

export default function MasterLogsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setError(null);
      setIsLoading(true);
      const res = await fetch(`/api/master/logs?page=${page}&limit=30`, { credentials: 'include' });
      const payload = (await res.json().catch(() => null)) as Payload | { error?: string } | null;
      if (!res.ok || !payload || 'error' in payload) {
        setError((payload as { error?: string } | null)?.error ?? 'No se pudo cargar');
        setIsLoading(false);
        return;
      }
      setData(payload as Payload);
      setIsLoading(false);
    };

    void load();
  }, [page]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Logs de ejecución n8n</h1>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">Página {page}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isLoading || page === 1}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={isLoading || !(data?.hasMore ?? false)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Log</th>
              </tr>
            </thead>
            <tbody>
              {(data?.logs ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">{row.id}</td>
                  <td className="px-4 py-3">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 whitespace-pre-wrap font-mono text-xs text-slate-800">{row.log ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
