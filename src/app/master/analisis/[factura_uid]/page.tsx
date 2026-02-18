'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye } from 'lucide-react';

import type { ValidationState } from '@/components/master/ComparisonFieldRow';
import { MASTER_ANALYSIS_SCORING_FIELDS, MASTER_ANALYSIS_VISIBLE_FIELDS } from '@/lib/master/analysisFields';
import TruncateWithTooltip from '@/components/TruncateWithTooltip';

type Factura = Record<string, unknown>;

type PayloadOk = {
  factura_uid: string;
  factura: Factura;
};

type Payload = PayloadOk | { error?: string };

const TableShell = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{children}</div>
);

type ValidationMap = Record<string, ValidationState>;

function formatFieldLabel(field: string) {
  const map: Record<string, string> = {
    numero: 'Número',
    tipo: 'Tipo',
    buyer_name: 'Nombre comprador',
    buyer_tax_id: 'CIF comprador',
    seller_name: 'Nombre vendedor',
    seller_tax_id: 'CIF vendedor',
    iva: 'IVA',
    importe_sin_iva: 'Base imponible',
    importe_total: 'Importe total',
    fecha: 'Fecha',
    invoice_concept: 'Concepto',
    invoice_reason: 'Razonamiento GPT',
    user_businessname: 'Empresa (dashboard)',
    drive_file_id: 'ID fichero',
    drive_file_name: 'Nombre fichero',
    factura_uid: 'Factura UID',
    empresa_id: 'Empresa ID',
  };

  return map[field] ?? field;
}

function nextHeaderState(state: ValidationState): ValidationState {
  if (state === 'unset') {
    return 'correct';
  }

  if (state === 'correct') {
    return 'incorrect';
  }

  return 'unset';
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return String(value);
}

function nextState(state: ValidationState): ValidationState {
  if (state === 'unset') {
    return 'correct';
  }
  if (state === 'correct') {
    return 'incorrect';
  }
  return 'unset';
}

function ValidationToggle({
  state,
  onChange,
  ariaLabel,
}: {
  state: ValidationState;
  onChange: (state: ValidationState) => void;
  ariaLabel: string;
}) {
  const styles =
    state === 'correct'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
      : state === 'incorrect'
        ? 'border-red-300 bg-red-50 text-red-700'
        : 'border-slate-300 bg-white text-transparent hover:bg-slate-50';

  const glyph = state === 'correct' ? '✓' : state === 'incorrect' ? '✕' : '•';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => onChange(nextState(state))}
      className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-md border text-[12px] font-bold leading-none ${styles}`}
    >
      {glyph}
    </button>
  );
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

  const [data, setData] = useState<PayloadOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftA, setDraftA] = useState<ValidationMap>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const draftARef = useRef<ValidationMap>({});
  const isDirtyRef = useRef(false);
  const saveSeqRef = useRef(0);
  const inFlightSaveRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    draftARef.current = draftA;
  }, [draftA]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

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

      setData(payload as PayloadOk);
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

        if (isDirtyRef.current) {
          return;
        }

        setDraftA(payload?.toolA ?? {});
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

      if (!isDirtyRef.current) {
        return true;
      }

      if (inFlightSaveRef.current) {
        return inFlightSaveRef.current;
      }

      const seq = (saveSeqRef.current += 1);
      const snapshotA = draftARef.current;
      const snapshotB = {};

      setSaveError(null);
      setIsSaving(true);

      const doSave = (async () => {
        try {
          const res = await fetch('/api/master/analisis/review', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ factura_uid, toolA: snapshotA, toolB: snapshotB }),
            keepalive: opts?.keepalive === true,
          });

          const payload = (await res.json().catch(() => null)) as { error?: string; updatedAt?: string | null } | null;
          if (!res.ok) {
            setSaveError(payload?.error ?? 'No se pudo guardar');
            return false;
          }

          if (saveSeqRef.current === seq) {
            setIsDirty(false);
            setLastSavedAt(payload?.updatedAt ?? new Date().toISOString());
          }

          return true;
        } catch {
          setSaveError('No se pudo guardar');
          return false;
        } finally {
          inFlightSaveRef.current = null;
          setIsSaving(false);
        }
      })();

      inFlightSaveRef.current = doSave;
      return doSave;
    },
    [factura_uid]
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

  const VISIBLE_FIELDS = useMemo(() => new Set(MASTER_ANALYSIS_VISIBLE_FIELDS as readonly string[]), []);

  const filteredDiffs = useMemo(() => {
    if (!data) {
      return [];
    }
    const orderIndex = new Map<string, number>((MASTER_ANALYSIS_VISIBLE_FIELDS as readonly string[]).map((f, idx) => [f, idx]));
    return (MASTER_ANALYSIS_VISIBLE_FIELDS as readonly string[])
      .filter((field) => VISIBLE_FIELDS.has(field))
      .map((field) => ({ field, value: data.factura?.[field] ?? null }))
      .slice()
      .sort((a, b) => {
        const ia = orderIndex.get(a.field) ?? 9_999;
        const ib = orderIndex.get(b.field) ?? 9_999;
        return ia - ib;
      });
  }, [data, MASTER_ANALYSIS_VISIBLE_FIELDS, VISIBLE_FIELDS]);

  const scoringDiffs = useMemo(() => {
    return filteredDiffs.filter((d) => (MASTER_ANALYSIS_SCORING_FIELDS as readonly string[]).includes(d.field));
  }, [filteredDiffs]);

  const totalFields = useMemo(() => scoringDiffs.length, [scoringDiffs]);

  const correctCountA = useMemo(() => {
    return scoringDiffs.reduce((acc, d) => acc + (draftA[d.field] === 'correct' ? 1 : 0), 0);
  }, [scoringDiffs, draftA]);

  const driveType = useMemo(() => {
    if (!data) {
      return null;
    }

    const raw = (data.factura?.drive_type ?? '').toString().trim().toLowerCase();
    if (raw === 'googledrive' || raw === 'onedrive') {
      return raw;
    }

    const fileId = (data.factura?.drive_file_id ?? '').toString().trim();
    return fileId ? 'googledrive' : null;
  }, [data]);

  const empresaId = useMemo(() => {
    if (!data) {
      return null;
    }
    return data.factura?.empresa_id ?? null;
  }, [data]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (!data) {
      setPreviewUrl(null);
      setEmbedUrl(null);
      setIsPreviewLoading(false);
      return;
    }

    const fileId = (data.factura?.drive_file_id ?? '').toString().trim();
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

        <div className="flex items-center gap-2">
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      {data ? (
        <>
          <div className="relative gap-6 lg:grid lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-semibold text-slate-900">% Acierto</span>
                    <span className="font-mono text-xs">{percentA === null ? '—' : `${percentA.toFixed(0)}%`}</span>
                  </span>
                  {lastSavedAt ? (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">Últ. guar.</span>
                        <span className="font-mono text-xs">{new Date(lastSavedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/')} {new Date(lastSavedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    </>
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
                        <th className="w-[30%] px-4 py-3">Campo</th>
                        <th className="w-[45%] px-4 py-3">Valor OCR</th>
                        <th className="w-[25%] px-4 py-3">
                          <div className="flex items-center justify-center">
                            <ColumnHeaderToggle
                              label="OK"
                              counter={`${correctCountA}/${totalFields}`}
                              state={
                                scoringDiffs.length
                                  ? deriveHeaderState(scoringDiffs.map((d) => draftA[d.field] ?? 'unset'))
                                  : 'unset'
                              }
                              onChange={(state) => {
                                const next: ValidationMap = { ...draftARef.current };
                                for (const d of scoringDiffs) {
                                  next[d.field] = state;
                                }
                                draftARef.current = next;
                                setDraftA(next);
                                setIsDirty(true);
                              }}
                            />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDiffs.map((d) => (
                        <tr key={d.field} className="border-t border-slate-100">
                          <td className="w-[30%] px-4 py-3 text-xs font-semibold text-slate-700">
                            <TruncateWithTooltip value={formatFieldLabel(d.field)} />
                          </td>
                          <td className="w-[45%] px-4 py-3">
                            <TruncateWithTooltip value={formatValue(d.value)} />
                          </td>
                          <td className="w-[25%] px-4 py-3">
                            <div className="flex items-center justify-center">
                              {(MASTER_ANALYSIS_SCORING_FIELDS as readonly string[]).includes(d.field) ? (
                                <ValidationToggle
                                  state={draftA[d.field] ?? 'unset'}
                                  onChange={(state) => {
                                    setDraftA((prev) => {
                                      const next = { ...prev, [d.field]: state };
                                      draftARef.current = next;
                                      return next;
                                    });
                                    setIsDirty(true);
                                  }}
                                  ariaLabel={`Validación para ${d.field}`}
                                />
                              ) : (
                                <span className="font-mono text-xs text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
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

            <div className="absolute top-0 right-0 w-full lg:relative lg:w-auto lg:sticky lg:top-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-slate-900">Vista previa</div>
                </div>

                {embedUrl ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <iframe
                      title="Vista previa factura"
                      src={embedUrl}
                      className="block h-[90vh] w-full rounded-lg bg-white"
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
          </div>
        </>
      ) : null}
    </div>
  );
}
