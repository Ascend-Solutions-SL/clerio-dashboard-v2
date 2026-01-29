'use client';

import { useEffect, useState } from 'react';

type LogRow = {
  id: number;
  created_at: string;
  log: string | null;
  user_uid: string | null;
  user_businessname: string | null;
};

type Payload = { logs: LogRow[]; page: number; limit: number; hasMore: boolean };

export default function MasterLogsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [startDay, setStartDay] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endDay, setEndDay] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [endYear, setEndYear] = useState('');

  const years = Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => String(2000 + i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  const buildDate = (year: string, month: string, day: string) => {
    if (!year || !month || !day) {
      return '';
    }

    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const candidate = new Date(Date.UTC(y, m - 1, d));
    if (
      candidate.getUTCFullYear() !== y ||
      candidate.getUTCMonth() !== m - 1 ||
      candidate.getUTCDate() !== d
    ) {
      return '';
    }

    return `${year}-${month}-${day}`;
  };

  const start = buildDate(startYear, startMonth, startDay);
  const end = buildDate(endYear, endMonth, endDay);

  useEffect(() => {
    setPage(1);
  }, [query, start, end]);

  useEffect(() => {
    const load = async () => {
      setError(null);
      setIsLoading(true);
      const q = query.trim();
      const queryPart = q ? `&q=${encodeURIComponent(q)}` : '';
      const startPart = start ? `&start=${encodeURIComponent(start)}` : '';
      const endPart = end ? `&end=${encodeURIComponent(end)}` : '';
      const res = await fetch(`/api/master/logs?page=${page}&limit=30${queryPart}${startPart}${endPart}`, { credentials: 'include' });
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
  }, [page, query, start, end]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Logs de ejecución n8n</h1>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex w-full max-w-[560px] items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por usuario o empresa"
            className="w-full max-w-[360px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDateFilterOpen((v) => !v)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              Filtrar por fecha
            </button>
            {isDateFilterOpen ? (
              <div className="absolute left-0 z-20 mt-2 w-[520px] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-600">Fecha inicio</div>
                    <div className="flex gap-2">
                      <select
                        value={startDay}
                        onChange={(e) => setStartDay(e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                      >
                        <option value="">Día</option>
                        {days.map((d) => (
                          <option key={`sd-${d}`} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <select
                        value={startMonth}
                        onChange={(e) => setStartMonth(e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                      >
                        <option value="">Mes</option>
                        {months.map((m) => (
                          <option key={`sm-${m}`} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={startYear}
                        onChange={(e) => setStartYear(e.target.value)}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                      >
                        <option value="">Año</option>
                        {years.map((y) => (
                          <option key={`sy-${y}`} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-600">Fecha fin</div>
                    <div className="flex gap-2">
                      <select
                        value={endDay}
                        onChange={(e) => setEndDay(e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                      >
                        <option value="">Día</option>
                        {days.map((d) => (
                          <option key={`ed-${d}`} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <select
                        value={endMonth}
                        onChange={(e) => setEndMonth(e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                      >
                        <option value="">Mes</option>
                        {months.map((m) => (
                          <option key={`em-${m}`} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={endYear}
                        onChange={(e) => setEndYear(e.target.value)}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                      >
                        <option value="">Año</option>
                        {years.map((y) => (
                          <option key={`ey-${y}`} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setStartDay('');
                      setStartMonth('');
                      setStartYear('');
                      setEndDay('');
                      setEndMonth('');
                      setEndYear('');
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDateFilterOpen(false)}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-slate-600">Página {page}</div>
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
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Log</th>
              </tr>
            </thead>
            <tbody>
              {(data?.logs ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">{row.id}</td>
                  <td className="px-4 py-3">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{row.user_uid ?? ''}</td>
                  <td className="px-4 py-3">{row.user_businessname ?? ''}</td>
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
