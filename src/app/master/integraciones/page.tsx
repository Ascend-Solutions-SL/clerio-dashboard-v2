'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

import TruncateWithTooltip from '@/components/TruncateWithTooltip';

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

type SummaryEmpresaRow = {
  empresa: string | null;
};

type SummaryPayload = {
  empresas: SummaryEmpresaRow[];
};

const Table = ({ title, logoSrc, rows }: { title: string; logoSrc: string; rows: IntegrationRow[] }) => {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Image src={logoSrc} alt={title} width={18} height={18} className="h-[18px] w-[18px] object-contain" />
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[240px] overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-xs font-semibold text-slate-600">
                <th className="w-[14%] px-4 py-3">Nombre</th>
                <th className="w-[18%] px-4 py-3">Apellidos</th>
                <th className="w-[18%] px-4 py-3">Empresa</th>
                <th className="w-[50%] px-4 py-3">Email integración</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.user_uid}-${row.email}`} className="border-t border-slate-100">
                  <td className="w-[14%] px-4 py-3"><TruncateWithTooltip value={row.first_name} /></td>
                  <td className="w-[18%] px-4 py-3"><TruncateWithTooltip value={row.last_name} /></td>
                  <td className="w-[18%] px-4 py-3"><TruncateWithTooltip value={row.user_businessname} /></td>
                  <td className="w-[50%] px-4 py-3"><TruncateWithTooltip value={row.email} /></td>
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
  const [filterQuery, setFilterQuery] = useState('');
  const [empresaOptions, setEmpresaOptions] = useState<string[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      setError(null);
      const [integrationsRes, summaryRes] = await Promise.all([
        fetch('/api/master/integrations', { credentials: 'include' }),
        fetch('/api/master/summary', { credentials: 'include' }),
      ]);

      const integrationsPayload = (await integrationsRes.json().catch(() => null)) as
        | IntegrationsPayload
        | { error?: string }
        | null;
      if (!integrationsRes.ok || !integrationsPayload || 'error' in integrationsPayload) {
        setError((integrationsPayload as { error?: string } | null)?.error ?? 'No se pudo cargar');
        return;
      }
      setData(integrationsPayload as IntegrationsPayload);

      const summaryPayload = (await summaryRes.json().catch(() => null)) as SummaryPayload | { error?: string } | null;
      if (summaryRes.ok && summaryPayload && 'empresas' in summaryPayload) {
        const empresas = (summaryPayload.empresas ?? [])
          .map((row: SummaryEmpresaRow) => row.empresa ?? '')
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b));
        setEmpresaOptions(empresas);
      }
    };

    void load();
  }, []);

  const applyFilters = (rows: IntegrationRow[]) => {
    const q = filterQuery.trim().toLowerCase();
    const company = selectedEmpresa.trim().toLowerCase();

    return rows.filter((row) => {
      if (company && row.user_businessname.trim().toLowerCase() !== company) {
        return false;
      }
      if (!q) {
        return true;
      }

      const haystack = [row.first_name, row.last_name, row.user_businessname, row.email]
        .map((value) => String(value ?? '').toLowerCase())
        .join(' ');
      return haystack.includes(q);
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Integraciones de Usuarios</h1>
          <div className="flex w-full max-w-xl flex-wrap items-center justify-end gap-2">
            <select
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
              className="w-full max-w-[260px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            >
              <option value="">Todas las empresas</option>
              {empresaOptions.map((empresa) => (
                <option key={empresa} value={empresa}>
                  {empresa}
                </option>
              ))}
            </select>
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Buscar"
              className="w-full max-w-[260px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
          </div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <Table title="Drive" logoSrc="/brand/master_section/drive_logo.png" rows={applyFilters(data?.drive ?? [])} />
      <Table title="One Drive" logoSrc="/brand/master_section/onedrive_logo.png" rows={applyFilters(data?.onedrive ?? [])} />
      <Table title="Gmail" logoSrc="/brand/master_section/gmail_logo.png" rows={applyFilters(data?.gmail ?? [])} />
      <Table title="Outlook" logoSrc="/brand/master_section/outlook_logo.png" rows={applyFilters(data?.outlook ?? [])} />
    </div>
  );
}
