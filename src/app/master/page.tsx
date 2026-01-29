'use client';

import { useEffect, useState } from 'react';

type EmpresaRow = {
  id: number;
  empresa: string;
  cif: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
};

type AuthUserRow = {
  user_uid: string;
  user_email: string;
  first_name: string;
  last_name: string;
  user_businessname: string;
  user_business_cif: string | null;
  user_role: string;
  empresa_id: number | null;
  created_at: string;
};

type SummaryPayload = {
  empresas: EmpresaRow[];
  usuarios: AuthUserRow[];
};

const Table = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{children}</div>
);

export default function MasterHomePage() {
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [empresaQuery, setEmpresaQuery] = useState('');
  const [usuarioQuery, setUsuarioQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      setError(null);
      const res = await fetch('/api/master/summary', { credentials: 'include' });
      const payload = (await res.json().catch(() => null)) as SummaryPayload | { error?: string } | null;
      if (!res.ok || !payload || 'error' in payload) {
        setError((payload as { error?: string } | null)?.error ?? 'No se pudo cargar');
        return;
      }
      setData(payload as SummaryPayload);
    };

    void load();
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Resumen Empresas/Usuarios</h1>
        <p className="mt-1 text-sm text-slate-600">Vista master (acceso restringido).</p>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Empresas</h2>
          <input
            value={empresaQuery}
            onChange={(e) => setEmpresaQuery(e.target.value)}
            placeholder="Buscar"
            className="w-full max-w-[320px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          />
        </div>
        <Table>
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="w-[80px] px-4 py-3">ID</th>
                  <th className="w-[260px] px-4 py-3">Empresa</th>
                  <th className="w-[140px] px-4 py-3">CIF</th>
                  <th className="w-[150px] px-4 py-3">Teléfono</th>
                  <th className="w-[320px] px-4 py-3">Dirección</th>
                  <th className="w-[260px] px-4 py-3">Email</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const query = empresaQuery.trim().toLowerCase();
                  const rows = [...(data?.empresas ?? [])].sort((a, b) => (a.empresa ?? '').localeCompare(b.empresa ?? ''));

                  const filtered = query
                    ? rows.filter((row) =>
                        [row.id, row.empresa, row.cif, row.telefono, row.direccion, row.email]
                          .map((value) => String(value ?? '').toLowerCase())
                          .some((value) => value.includes(query))
                      )
                    : rows;

                  return filtered.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="w-[80px] px-4 py-3">{row.id}</td>
                    <td className="w-[260px] truncate px-4 py-3">{row.empresa}</td>
                    <td className="w-[140px] truncate px-4 py-3">{row.cif ?? ''}</td>
                    <td className="w-[150px] truncate px-4 py-3">{row.telefono ?? ''}</td>
                    <td className="w-[320px] truncate px-4 py-3">{row.direccion ?? ''}</td>
                    <td className="w-[260px] truncate px-4 py-3">{row.email ?? ''}</td>
                  </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </Table>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Usuarios</h2>
          <input
            value={usuarioQuery}
            onChange={(e) => setUsuarioQuery(e.target.value)}
            placeholder="Buscar"
            className="w-full max-w-[320px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          />
        </div>
        <Table>
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="w-[180px] px-4 py-3">Nombre</th>
                  <th className="w-[220px] px-4 py-3">Apellidos</th>
                  <th className="w-[280px] px-4 py-3">Email</th>
                  <th className="w-[260px] px-4 py-3">Empresa</th>
                  <th className="w-[160px] px-4 py-3">CIF</th>
                  <th className="w-[140px] px-4 py-3">Rol</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const query = usuarioQuery.trim().toLowerCase();
                  const rows = [...(data?.usuarios ?? [])].sort((a, b) =>
                    (a.user_businessname ?? '').localeCompare(b.user_businessname ?? '')
                  );

                  const filtered = query
                    ? rows.filter((row) =>
                        [
                          row.first_name,
                          row.last_name,
                          row.user_email,
                          row.user_businessname,
                          row.user_business_cif,
                          row.user_role,
                          row.empresa_id,
                        ]
                          .map((value) => String(value ?? '').toLowerCase())
                          .some((value) => value.includes(query))
                      )
                    : rows;

                  return filtered.map((row) => (
                  <tr key={row.user_uid} className="border-t border-slate-100">
                    <td className="w-[180px] truncate px-4 py-3">{row.first_name}</td>
                    <td className="w-[220px] truncate px-4 py-3">{row.last_name}</td>
                    <td className="w-[280px] truncate px-4 py-3">{row.user_email}</td>
                    <td className="w-[260px] truncate px-4 py-3">{row.user_businessname}</td>
                    <td className="w-[160px] truncate px-4 py-3">{row.user_business_cif ?? ''}</td>
                    <td className="w-[140px] truncate px-4 py-3">{row.user_role}</td>
                  </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </Table>
      </section>
    </div>
  );
}
