'use client';

import { useEffect, useMemo, useState } from 'react';

type ProfilePayload = {
  employee: {
    firstName: string;
    lastName: string;
    email: string;
  };
  company: {
    businessName: string;
    cif: string;
    phone: string;
    address: string;
  };
  role: string;
};

const Badge = ({ role }: { role: string }) => {
  const normalized = role.toLowerCase();
  const isAdmin = normalized === 'admin';
  const label = isAdmin ? 'Admin' : 'Empleado';

  const className = isAdmin
    ? 'inline-flex items-center rounded-full border border-blue-800 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900'
    : 'inline-flex items-center rounded-full border border-orange-800 bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-900';

  return <span className={className}>{label}</span>;
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <div className="mt-2 h-px w-full bg-slate-200" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
};

const ReadonlyInput = ({ value }: { value: string }) => {
  return (
    <input
      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
      value={value}
      readOnly
      disabled
    />
  );
};

const EditableInput = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  return (
    <input
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [payload, setPayload] = useState<ProfilePayload | null>(null);

  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  const canSave = useMemo(() => !!payload && !isLoading && !isSaving, [payload, isLoading, isSaving]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setMessage(null);

      try {
        const response = await fetch('/api/settings/profile', { credentials: 'include' });
        const data = (await response.json().catch(() => null)) as ProfilePayload | { error?: string } | null;

        if (!response.ok || !data || 'error' in data) {
          throw new Error((data as { error?: string } | null)?.error ?? 'No se pudo cargar la configuración');
        }

        setPayload(data as ProfilePayload);
        setCompanyPhone((data as ProfilePayload).company.phone ?? '');
        setCompanyAddress((data as ProfilePayload).company.address ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const handleSave = async () => {
    if (!payload) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/profile', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ telefono: companyPhone, direccion: companyAddress }),
      });

      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'No se pudo actualizar');
      }

      setMessage('Datos actualizados');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="rounded-2xl bg-white p-8 shadow-sm">Cargando…</div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="w-full">
        <div className="rounded-2xl bg-white p-8 shadow-sm">No se pudo cargar la configuración.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Configuración</h1>
          <p className="mt-1 text-sm text-slate-600">Información básica de tu cuenta y empresa.</p>
        </div>
        <div className="shrink-0">
          <Badge role={payload.role} />
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      <Section title="Datos Empleado">
        <Field label="Nombre">
          <ReadonlyInput value={payload.employee.firstName ?? ''} />
        </Field>
        <Field label="Apellidos">
          <ReadonlyInput value={payload.employee.lastName ?? ''} />
        </Field>
        <Field label="Email">
          <ReadonlyInput value={payload.employee.email ?? ''} />
        </Field>
      </Section>

      <Section title="Datos Empresa">
        <Field label="Nombre de Empresa">
          <ReadonlyInput value={payload.company.businessName ?? ''} />
        </Field>
        <Field label="CIF">
          <ReadonlyInput value={payload.company.cif ?? ''} />
        </Field>
        <Field label="Teléfono Empresa">
          <EditableInput value={companyPhone} onChange={setCompanyPhone} />
        </Field>
        <Field label="Dirección">
          <EditableInput value={companyAddress} onChange={setCompanyAddress} />
        </Field>
      </Section>

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void handleSave()}
          disabled={!canSave}
        >
          {isSaving ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
    </div>
  );
}
