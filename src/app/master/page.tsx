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
        <h2 className="text-sm font-bold text-slate-900">Empresas</h2>
        <Table>
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">CIF</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Dirección</th>
                  <th className="px-4 py-3">Email</th>
                </tr>
              </thead>
              <tbody>
                {(data?.empresas ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{row.id}</td>
                    <td className="px-4 py-3">{row.empresa}</td>
                    <td className="px-4 py-3">{row.cif ?? ''}</td>
                    <td className="px-4 py-3">{row.telefono ?? ''}</td>
                    <td className="px-4 py-3">{row.direccion ?? ''}</td>
                    <td className="px-4 py-3">{row.email ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">Usuarios</h2>
        <Table>
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Apellidos</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">CIF</th>
                  <th className="px-4 py-3">Rol</th>
                </tr>
              </thead>
              <tbody>
                {(data?.usuarios ?? []).map((row) => (
                  <tr key={row.user_uid} className="border-t border-slate-100">
                    <td className="px-4 py-3">{row.first_name}</td>
                    <td className="px-4 py-3">{row.last_name}</td>
                    <td className="px-4 py-3">{row.user_email}</td>
                    <td className="px-4 py-3">{row.user_businessname}</td>
                    <td className="px-4 py-3">{row.user_business_cif ?? ''}</td>
                    <td className="px-4 py-3">{row.user_role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Table>
      </section>
    </div>
  );
}
