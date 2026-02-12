'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

import ComparisonFieldRow from '@/components/master/ComparisonFieldRow';
import type { ValidationState } from '@/components/master/ComparisonFieldRow';
import StatusBadge from '@/components/master/StatusBadge';
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

type ValidationMap = Record<string, ValidationState>;

function nextHeaderState(state: ValidationState): ValidationState {
  if (state === 'unset') {
    return 'correct';
  }

  if (state === 'correct') {
    return 'incorrect';
  }

  return 'unset';
}

function ColumnHeaderToggle({
  state,
  onChange,
  label,
  counter,
}: {
  state: ValidationState;
  onChange: (state: ValidationState) => void;
  label: string;
  counter: string;
}) {
  const styles =
    state === 'correct'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
      : state === 'incorrect'
        ? 'border-red-300 bg-red-50 text-red-700'
        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50';

  const glyph = state === 'correct' ? '✓' : state === 'incorrect' ? '✕' : '';

  return (
    <button
      type="button"
      onClick={() => onChange(nextHeaderState(state))}
      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-semibold ${styles}`}
      aria-label={`Cambiar validación de columna ${label}`}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-md border border-current text-[11px] font-bold leading-none">
        {glyph}
      </span>
      <span>{label}</span>
      <span className="font-mono text-[11px] opacity-80">{counter}</span>
    </button>
  );
}

function deriveHeaderState(values: ValidationState[]): ValidationState {
  if (values.length === 0) {
    return 'unset';
  }

  const allCorrect = values.every((v) => v === 'correct');
  if (allCorrect) {
    return 'correct';
  }

  const allIncorrect = values.every((v) => v === 'incorrect');
  if (allIncorrect) {
    return 'incorrect';
  }

  return 'unset';
}

export default function MasterAnalisisDetailPage() {
  const params = useParams<{ factura_uid: string }>();
  const factura_uid = useMemo(() => decodeURIComponent(params.factura_uid), [params.factura_uid]);

  const [data, setData] = useState<PayloadOk | PayloadMissing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftA, setDraftA] = useState<ValidationMap>({});
  const [draftB, setDraftB] = useState<ValidationMap>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const loadReview = async () => {
      try {
        const url = new URL('/api/master/analisis/review', window.location.origin);
        url.searchParams.set('factura_uid', factura_uid);

        const res = await fetch(url.toString(), { credentials: 'include' });
        const payload = (await res.json().catch(() => null)) as
          | { toolA?: ValidationMap; toolB?: ValidationMap; updatedAt?: string | null; error?: string }
          | null;

        if (!res.ok) {
          return;
        }

        setDraftA(payload?.toolA ?? {});
        setDraftB(payload?.toolB ?? {});
        setLastSavedAt(payload?.updatedAt ?? null);
        setIsDirty(false);
        setSaveError(null);
      } catch {
        // ignore load errors; user can still work locally
      }
    };

    void loadReview();
  }, [factura_uid]);

  const saveReview = useCallback(
    async (opts?: { keepalive?: boolean }) => {
      if (typeof window === 'undefined') {
        return false;
      }

      if (!isDirty) {
        return true;
      }

      setSaveError(null);
      setIsSaving(true);

      try {
        const res = await fetch('/api/master/analisis/review', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ factura_uid, toolA: draftA, toolB: draftB }),
          keepalive: opts?.keepalive === true,
        });

        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setSaveError(payload?.error ?? 'No se pudo guardar');
          return false;
        }

        setIsDirty(false);
        setLastSavedAt(new Date().toISOString());
        return true;
      } catch {
        setSaveError('No se pudo guardar');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [draftA, draftB, factura_uid, isDirty]
  );

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!isDirty) {
        return;
      }
      void saveReview({ keepalive: true });
    };

    const onPageHide = () => {
      if (!isDirty) {
        return;
      }
      void saveReview({ keepalive: true });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') {
        return;
      }
      if (!isDirty) {
        return;
      }
      void saveReview({ keepalive: true });
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, saveReview]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!isDirty) {
        return;
      }

      if (event.defaultPrevented) {
        return;
      }

      if (event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (!anchor) {
        return;
      }

      if (anchor.target && anchor.target !== '_self') {
        return;
      }

      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('/')) {
        return;
      }

      // solo navegación interna del dashboard (master)
      if (!href.startsWith('/master')) {
        return;
      }

      // ya estamos aquí
      if (href === window.location.pathname) {
        return;
      }

      event.preventDefault();
      void saveReview().then(() => {
        window.location.href = href;
      });
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  }, [isDirty, saveReview]);

  const VISIBLE_FIELDS = useMemo(
    () =>
      new Set([
        'numero',
        'tipo',
        'nombre_comprador',
        'cif_comprador',
        'nombre_vendedor',
        'cif_vendedor',
        'cliente_proveedor',
        'iva',
        'importe_sin_iva',
        'importe_total',
        'fecha',
        'concepto',
        'user_businessname',
      ]),
    []
  );

  const filteredDiffs = useMemo(() => {
    if (!data || !('comparison' in data)) {
      return [];
    }
    return data.comparison.diffs.filter((d) => VISIBLE_FIELDS.has(d.field));
  }, [data, VISIBLE_FIELDS]);

  const totalFields = useMemo(() => filteredDiffs.length, [filteredDiffs]);

  const correctCountA = useMemo(() => {
    return filteredDiffs.reduce((acc, d) => acc + (draftA[d.field] === 'correct' ? 1 : 0), 0);
  }, [filteredDiffs, draftA]);

  const correctCountB = useMemo(() => {
    return filteredDiffs.reduce((acc, d) => acc + (draftB[d.field] === 'correct' ? 1 : 0), 0);
  }, [filteredDiffs, draftB]);

  const driveType = useMemo(() => {
    if (!data || !('comparison' in data)) {
      return null;
    }

    const raw = (data.comparison.a.drive_type ?? data.comparison.b.drive_type ?? '').toString().trim().toLowerCase();
    if (raw === 'googledrive' || raw === 'onedrive') {
      return raw;
    }

    const fileId = data.comparison.a.drive_file_id ?? data.comparison.b.drive_file_id;
    return fileId ? 'googledrive' : null;
  }, [data]);

  const empresaId = useMemo(() => {
    if (!data || !('comparison' in data)) {
      return null;
    }
    return data.comparison.a.empresa_id ?? data.comparison.b.empresa_id ?? null;
  }, [data]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (!data || !('comparison' in data)) {
      setPreviewUrl(null);
      setEmbedUrl(null);
      setIsPreviewLoading(false);
      return;
    }

    const fileId = data.comparison.a.drive_file_id ?? data.comparison.b.drive_file_id;
    if (!fileId) {
      setPreviewUrl(null);
      setEmbedUrl(null);
      setIsPreviewLoading(false);
      return;
    }

    if (!driveType) {
      setPreviewUrl(null);
      setEmbedUrl(null);
      setIsPreviewLoading(false);
      return;
    }

    if (driveType === 'googledrive') {
      const url = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
      setPreviewUrl(url);
      setEmbedUrl(url);
      setIsPreviewLoading(false);
      return;
    }

    if (!empresaId) {
      setPreviewUrl(null);
      setEmbedUrl(null);
      setIsPreviewLoading(false);
      return;
    }

    const resolve = async () => {
      setIsPreviewLoading(true);
      try {
        const base = new URL('/api/master/files/link', window.location.origin);
        base.searchParams.set('drive_type', 'onedrive');
        base.searchParams.set('drive_file_id', fileId);
        base.searchParams.set('empresa_id', String(empresaId));

        const p = new URL(base.toString());
        p.searchParams.set('kind', 'preview');
        const e = new URL(base.toString());
        e.searchParams.set('kind', 'embed');

        const [resP, resE] = await Promise.all([
          fetch(p.toString(), { credentials: 'include' }),
          fetch(e.toString(), { credentials: 'include' }),
        ]);

        const payloadP = (await resP.json().catch(() => null)) as { url?: string } | null;
        const payloadE = (await resE.json().catch(() => null)) as { url?: string } | null;

        setPreviewUrl(resP.ok ? payloadP?.url ?? null : null);
        setEmbedUrl(resE.ok ? payloadE?.url ?? null : null);
      } catch {
        setPreviewUrl(null);
        setEmbedUrl(null);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    void resolve();
  }, [data, driveType, empresaId]);

  const percentA = useMemo(() => {
    if (totalFields <= 0) {
      return null;
    }
    return (correctCountA / totalFields) * 100;
  }, [correctCountA, totalFields]);

  const percentB = useMemo(() => {
    if (totalFields <= 0) {
      return null;
    }
    return (correctCountB / totalFields) * 100;
  }, [correctCountB, totalFields]);

  const bestMethod = useMemo(() => {
    if (percentA === null || percentB === null) {
      return null;
    }
    if (Math.abs(percentA - percentB) < 0.00001) {
      return 'Igual';
    }
    return percentA > percentB ? 'A' : 'B';
  }, [percentA, percentB]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Detalle Analisis</h1>
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50"
              aria-label="Abrir vista previa"
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
          <Link
            href="/master/analisis"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Volver
          </Link>
          <Link
            href="/master/analisis/metricas"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Métricas
          </Link>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      {data && 'comparison' in data ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr_520px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <StatusBadge status={data.status} />
                  <div className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">{data.comparison.diffCount}</span> diferencias detectadas
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-semibold text-slate-900">OCR Básico (A)</span>
                    <span className="font-mono text-xs">{percentA === null ? '—' : `${percentA.toFixed(0)}%`}</span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-semibold text-slate-900">OCR Google AI (B)</span>
                    <span className="font-mono text-xs">{percentB === null ? '—' : `${percentB.toFixed(0)}%`}</span>
                  </span>
                  {bestMethod ? (
                    <span className="ml-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      Mejor: {bestMethod}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-sm text-slate-700">
                  {isDirty ? (
                    <span className="font-semibold text-slate-900">Cambios sin guardar</span>
                  ) : (
                    <span className="text-slate-600">Sin cambios pendientes</span>
                  )}
                  {lastSavedAt ? (
                    <span className="ml-2 text-xs text-slate-500">(último guardado: {new Date(lastSavedAt).toLocaleString()})</span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {saveError ? <div className="text-sm font-semibold text-red-700">{saveError}</div> : null}
                  <button
                    type="button"
                    onClick={() => void saveReview()}
                    disabled={!isDirty || isSaving}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition-colors ${
                      !isDirty || isSaving
                        ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>

              <TableShell>
                <div className="overflow-x-hidden">
                  <table className="w-full table-fixed text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="text-left text-xs font-semibold text-slate-600">
                        <th className="w-[24%] px-4 py-3">Campo</th>
                        <th className="w-[38%] px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <ColumnHeaderToggle
                              label="A"
                              counter={`${correctCountA}/${totalFields}`}
                              state={
                                filteredDiffs.length
                                  ? deriveHeaderState(filteredDiffs.map((d) => draftA[d.field] ?? 'unset'))
                                  : 'unset'
                              }
                              onChange={(state) => {
                                const next: ValidationMap = {};
                                for (const d of filteredDiffs) {
                                  next[d.field] = state;
                                }
                                setDraftA(next);
                                setIsDirty(true);
                              }}
                            />
                          </div>
                        </th>
                        <th className="w-[38%] px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <ColumnHeaderToggle
                              label="B"
                              counter={`${correctCountB}/${totalFields}`}
                              state={
                                filteredDiffs.length
                                  ? deriveHeaderState(filteredDiffs.map((d) => draftB[d.field] ?? 'unset'))
                                  : 'unset'
                              }
                              onChange={(state) => {
                                const next: ValidationMap = {};
                                for (const d of filteredDiffs) {
                                  next[d.field] = state;
                                }
                                setDraftB(next);
                                setIsDirty(true);
                              }}
                            />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDiffs.map((d) => (
                        <ComparisonFieldRow
                          key={d.field}
                          field={d.field}
                          a={formatValue(d.a)}
                          b={formatValue(d.b)}
                          equal={d.equal}
                          aState={draftA[d.field] ?? 'unset'}
                          bState={draftB[d.field] ?? 'unset'}
                          onChangeA={(state) => {
                            setDraftA((prev) => ({ ...prev, [d.field]: state }));
                            setIsDirty(true);
                          }}
                          onChangeB={(state) => {
                            setDraftB((prev) => ({ ...prev, [d.field]: state }));
                            setIsDirty(true);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </TableShell>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 text-[12px] font-bold text-emerald-700">
                      ✓
                    </span>
                    <span>Correcto</span>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-red-300 bg-red-50 text-[12px] font-bold text-red-700">
                      ✕
                    </span>
                    <span>Incorrecto</span>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-[12px] font-bold text-transparent">
                      •
                    </span>
                    <span>Sin revisar</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-900">Vista previa</div>
                {previewUrl ? (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50"
                    aria-label="Abrir vista previa"
                    title="Abrir"
                  >
                    <Eye size={18} />
                  </a>
                ) : null}
              </div>

              {embedUrl ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <iframe
                    title="Vista previa factura"
                    src={embedUrl}
                    className="block h-[72vh] w-full rounded-lg bg-white"
                    allow="autoplay"
                    style={{ border: 0 }}
                  />
                </div>
              ) : isPreviewLoading ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Cargando vista previa...
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  No hay vista previa disponible para esta factura.
                </div>
              )}
            </div>
          </div>
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
