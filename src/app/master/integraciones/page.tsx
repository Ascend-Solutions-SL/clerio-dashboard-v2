'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type IntegrationRow = {
  user_uid: string;
  first_name: string;
  last_name: string;
  user_businessname: string;
  email: string;
};

type IntegrationsPayload = {
  drive: IntegrationRow[];
  onedrive: IntegrationRow[];
  gmail: IntegrationRow[];
  outlook: IntegrationRow[];
};

const Table = ({ title, logoSrc, rows }: { title: string; logoSrc: string; rows: IntegrationRow[] }) => {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Image src={logoSrc} alt={title} width={18} height={18} className="h-[18px] w-[18px] object-contain" />
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[240px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Apellidos</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Email integración</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.user_uid}-${row.email}`} className="border-t border-slate-100">
                  <td className="px-4 py-3">{row.first_name}</td>
                  <td className="px-4 py-3">{row.last_name}</td>
                  <td className="px-4 py-3">{row.user_businessname}</td>
                  <td className="px-4 py-3">{row.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default function MasterIntegrationsPage() {
  const [data, setData] = useState<IntegrationsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      const res = await fetch('/api/master/integrations', { credentials: 'include' });
      const payload = (await res.json().catch(() => null)) as IntegrationsPayload | { error?: string } | null;
      if (!res.ok || !payload || 'error' in payload) {
        setError((payload as { error?: string } | null)?.error ?? 'No se pudo cargar');
        return;
      }
      setData(payload as IntegrationsPayload);
    };

    void load();
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Integraciones de Usuarios</h1>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <Table title="Drive" logoSrc="/brand/master_section/drive_logo.png" rows={data?.drive ?? []} />
      <Table title="One Drive" logoSrc="/brand/master_section/onedrive_logo.png" rows={data?.onedrive ?? []} />
      <Table title="Gmail" logoSrc="/brand/master_section/gmail_logo.png" rows={data?.gmail ?? []} />
      <Table title="Outlook" logoSrc="/brand/master_section/outlook_logo.png" rows={data?.outlook ?? []} />
    </div>
  );
}
