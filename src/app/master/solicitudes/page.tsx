'use client';

import { useEffect, useState } from 'react';

type SolicitudRow = {
  id: string;
  created_at: string;
  herramienta: string;
  nivel_necesidad: string;
  comentarios: string | null;
  user_uid: string;
  first_name: string;
  last_name: string;
  user_businessname: string;
};

type Payload = { solicitudes: SolicitudRow[] };

export default function MasterSolicitudesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      const res = await fetch('/api/master/solicitudes', { credentials: 'include' });
      const payload = (await res.json().catch(() => null)) as Payload | { error?: string } | null;
      if (!res.ok || !payload || 'error' in payload) {
        setError((payload as { error?: string } | null)?.error ?? 'No se pudo cargar');
        return;
      }
      setData(payload as Payload);
    };

    void load();
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Solicitudes de Integración</h1>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Herramienta</th>
                <th className="px-4 py-3">Necesidad</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {(data?.solicitudes ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{row.herramienta}</td>
                  <td className="px-4 py-3">{row.nivel_necesidad}</td>
                  <td className="px-4 py-3">{row.first_name} {row.last_name}</td>
                  <td className="px-4 py-3">{row.user_businessname}</td>
                  <td className="px-4 py-3">{row.comentarios ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
