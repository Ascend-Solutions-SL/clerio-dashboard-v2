'use client';

import * as React from 'react';
import { Download, Eye, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

const TOGGLE_TRASH_WEBHOOK_URL = 'https://v-ascendsolutions.app.n8n.cloud/webhook/toggle-trash';

export type InvoiceDetailDrawerRow = {
  id?: string | number;
  numero?: string | number | null;
  fecha?: string | null;
  tipo?: string | null;
  counterparty?: string | null;
  importe_total?: number | string | null;
  divisa?: string | null;
  drive_type?: string | null;
  drive_file_id?: string | null;
  buyer_name?: string | null;
  buyer_tax_id?: string | null;
  seller_name?: string | null;
  seller_tax_id?: string | null;
  invoice_concept?: string | null;
  importe_sin_iva?: number | string | null;
  iva?: number | string | null;
  descuentos?: number | string | null;
  retenciones?: number | string | null;
};

type InvoiceDetailDrawerProps = {
  row: InvoiceDetailDrawerRow;
  onClose: () => void;
  onInvoiceTrashed?: (invoiceId: number) => void;
  closeAnimationMs?: number;
};

type FacturaDetailRow = {
  id: string | number;
  numero: string | number | null;
  fecha: string | null;
  tipo: string | null;
  divisa: string | null;
  drive_type: string | null;
  drive_file_id: string | null;
  buyer_name: string | null;
  buyer_tax_id: string | null;
  seller_name: string | null;
  seller_tax_id: string | null;
  invoice_concept: string | null;
  importe_sin_iva: number | string | null;
  iva: number | string | null;
  descuentos: number | string | null;
  retenciones: number | string | null;
  importe_total: number | string | null;
};

export function InvoiceDetailDrawer({ row, onClose, onInvoiceTrashed, closeAnimationMs = 260 }: InvoiceDetailDrawerProps) {
  const [isClosing, setIsClosing] = React.useState(false);
  const [dbRow, setDbRow] = React.useState<FacturaDetailRow | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isDeletingInvoice, setIsDeletingInvoice] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    setIsClosing(false);
  }, [row]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const numero = String(row.numero ?? '').trim();
    const tipo = String(row.tipo ?? '').trim();

    if (!numero) {
      setDbRow(null);
      setLoadError('No se encontró número de factura para consultar el detalle en DB.');
      setIsLoadingDetail(false);
      return;
    }

    let isMounted = true;
    setIsLoadingDetail(true);
    setLoadError(null);
    setDbRow(null);

    const loadDetail = async () => {
      let query = supabase
        .from('facturas')
        .select(
          'id, numero, fecha, tipo, divisa, drive_type, drive_file_id, buyer_name, buyer_tax_id, seller_name, seller_tax_id, invoice_concept, importe_sin_iva, iva, descuentos, retenciones, importe_total, updated_at'
        )
        .eq('numero', numero);

      if (tipo) {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query.order('updated_at', { ascending: false }).limit(1);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadError('No se pudo cargar el detalle de la factura desde DB.');
        setDbRow(null);
        setIsLoadingDetail(false);
        return;
      }

      const detail = Array.isArray(data) && data.length > 0 ? (data[0] as FacturaDetailRow) : null;
      if (!detail) {
        setLoadError('No existe una factura en DB para ese número.');
        setDbRow(null);
        setIsLoadingDetail(false);
        return;
      }

      setDbRow(detail);
      setIsLoadingDetail(false);
    };

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [row]);

  const closeDrawer = () => {
    if (isClosing) {
      return;
    }
    setIsClosing(true);
    timeoutRef.current = setTimeout(() => {
      onClose();
    }, closeAnimationMs);
  };

  const driveType = String(dbRow?.drive_type ?? '').trim();
  const driveFileId = String(dbRow?.drive_file_id ?? '').trim();
  const canOpen = Boolean(driveType && driveFileId);

  const previewHref = canOpen
    ? `/api/files/open?drive_type=${encodeURIComponent(driveType)}&drive_file_id=${encodeURIComponent(
        driveFileId
      )}&kind=preview`
    : undefined;
  const downloadHref = canOpen
    ? `/api/files/open?drive_type=${encodeURIComponent(driveType)}&drive_file_id=${encodeURIComponent(
        driveFileId
      )}&kind=download`
    : undefined;

  const currency = React.useMemo(() => {
    const raw = String(dbRow?.divisa ?? '').trim().toUpperCase();

    if (/^[A-Z]{3}$/.test(raw)) {
      try {
        // Validate against Intl to avoid RangeError
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: raw, minimumFractionDigits: 2 });
        return raw;
      } catch {
        // fall back below
      }
    }

    return 'EUR';
  }, [dbRow?.divisa]);
  const tipo = String(dbRow?.tipo ?? '').trim().toLowerCase();
  const counterparty =
    tipo === 'gastos'
      ? dbRow?.seller_name ?? dbRow?.buyer_name ?? null
      : dbRow?.buyer_name ?? dbRow?.seller_name ?? null;
  const renderValue = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text ? text : '—';
  };

  const renderMoney = (value: unknown) => {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(n);
  };

  const formatShortDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  };

  const invoiceIdForDelete = dbRow?.id ?? row.id;
  const canDeleteInvoice = invoiceIdForDelete != null && String(invoiceIdForDelete).trim().length > 0;

  const executeDeleteInvoice = async (invoiceId: number) => {
    toast({
      title: 'Eliminando factura',
      description: 'Estamos procesando la solicitud.',
    });

    onInvoiceTrashed?.(invoiceId);
    closeDrawer();

    setIsDeletingInvoice(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Autenticación JWT incorrecta o inexistente.');
      }

      const response = await fetch(TOGGLE_TRASH_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          factura_id: invoiceId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            message?: string;
            action?: 'restored' | 'moved_to_trash' | string;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message || 'No se pudo completar la acción.');
      }

      if (payload?.success === false) {
        throw new Error(payload.message || 'No se pudo completar la acción.');
      }

      const wasRestored = payload?.action === 'restored';

      toast({
        title: wasRestored ? 'Factura restaurada' : 'Factura eliminada',
        description: wasRestored
          ? 'La factura se ha restaurado correctamente.'
          : 'La factura se ha enviado correctamente a la papelera.',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
      });
    } catch (error) {
      toast({
        title: 'No se pudo eliminar la factura',
        description: error instanceof Error ? error.message : 'No se pudo completar la acción.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  const handleDeleteInvoice = () => {
    if (!canDeleteInvoice || isDeletingInvoice) {
      return;
    }

    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!canDeleteInvoice || isDeletingInvoice) {
      return;
    }

    const parsedInvoiceId = Number(invoiceIdForDelete);
    if (!Number.isFinite(parsedInvoiceId)) {
      setIsDeleteConfirmOpen(false);
      toast({
        title: 'No se pudo eliminar la factura',
        description: 'No se pudo identificar la factura seleccionada.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleteConfirmOpen(false);
    void executeDeleteInvoice(parsedInvoiceId);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[12px] font-semibold tracking-wide text-slate-700 uppercase">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{value}</div>
    </div>
  );

  return (
    <>
      <style jsx global>{`
        .invoice-drawer-backdrop-in {
          animation: invoiceDrawerBackdropIn 220ms ease-out both;
        }

        .invoice-drawer-backdrop-out {
          animation: invoiceDrawerBackdropOut 220ms ease-in both;
        }

        .invoice-drawer-sheet-in {
          animation: invoiceDrawerSheetIn 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }

        .invoice-drawer-sheet-out {
          animation: invoiceDrawerSheetOut 260ms cubic-bezier(0.4, 0, 1, 1) both;
          will-change: transform, opacity;
        }

        @keyframes invoiceDrawerBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes invoiceDrawerBackdropOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes invoiceDrawerSheetIn {
          from {
            transform: translateX(106%);
            opacity: 0.98;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes invoiceDrawerSheetOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(106%);
            opacity: 0.98;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .invoice-drawer-backdrop-in,
          .invoice-drawer-backdrop-out,
          .invoice-drawer-sheet-in,
          .invoice-drawer-sheet-out {
            animation: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50">
        <button
          type="button"
          aria-label="Cerrar"
          className={`absolute inset-0 bg-black/30 ${isClosing ? 'invoice-drawer-backdrop-out' : 'invoice-drawer-backdrop-in'}`}
          onClick={closeDrawer}
        />

        <div className="absolute right-3 top-3 bottom-3 w-[92vw] max-w-[520px]">
          <div
            className={`h-full rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl overflow-hidden ${
              isClosing ? 'invoice-drawer-sheet-out' : 'invoice-drawer-sheet-in'
            }`}
          >
            <div className="flex items-center justify-between gap-3 bg-white px-5 py-4 border-b border-slate-200">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">Detalle de factura</div>
                <div className="mt-0.5 text-[12px] text-slate-500 truncate">
                  {String(dbRow?.numero ?? row.numero ?? '—')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewHref ?? '#'}
                  target={previewHref ? '_blank' : undefined}
                  rel={previewHref ? 'noopener,noreferrer' : undefined}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition ${
                    canOpen
                      ? 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                      : 'border-slate-100 bg-slate-50 text-slate-400 pointer-events-none'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Eye className="h-4 w-4" />
                  Vista previa
                </a>
                <button
                  type="button"
                  disabled={!canOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (downloadHref) window.open(downloadHref, '_blank', 'noopener,noreferrer');
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition ${
                    canOpen
                      ? 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                      : 'border-slate-100 bg-slate-50 text-slate-400'
                  }`}
                >
                  <Download className="h-4 w-4" />
                  Descargar
                </button>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="h-full overflow-y-auto px-5 py-4 pb-6">
              {isLoadingDetail ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  Cargando detalle completo desde base de datos…
                </div>
              ) : loadError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{loadError}</div>
              ) : (
                <div className="space-y-3">
                <Section title="Resumen">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Número" value={renderValue(dbRow?.numero)} />
                    <Field label="Fecha" value={formatShortDate(dbRow?.fecha)} />
                    <Field label="Tipo" value={renderValue(dbRow?.tipo)} />
                  </div>
                  <div className="mt-3">
                    <Field label="Contraparte" value={renderValue(counterparty)} />
                  </div>
                </Section>

                <Section title="Comprador">
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
                    <Field label="CIF/NIF" value={renderValue(dbRow?.buyer_tax_id)} />
                    <Field label="Nombre" value={renderValue(dbRow?.buyer_name)} />
                  </div>
                </Section>

                <Section title="Vendedor">
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
                    <Field label="CIF/NIF" value={renderValue(dbRow?.seller_tax_id)} />
                    <Field label="Nombre" value={renderValue(dbRow?.seller_name)} />
                  </div>
                </Section>

                <Section title="Importes">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="IVA" value={<span className="font-mono">{renderMoney(dbRow?.iva)}</span>} />
                    <Field
                      label="Descuentos"
                      value={<span className="font-mono">{renderMoney(dbRow?.descuentos)}</span>}
                    />
                    <Field
                      label="Retenciones"
                      value={<span className="font-mono">{renderMoney(dbRow?.retenciones)}</span>}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Importe sin IVA"
                      value={<span className="font-mono font-semibold">{renderMoney(dbRow?.importe_sin_iva)}</span>}
                    />
                    <Field
                      label="Importe total"
                      value={<span className="font-mono font-semibold">{renderMoney(dbRow?.importe_total)}</span>}
                    />
                  </div>
                </Section>

                <Section title="Concepto">
                  <Field label="Descripción" value={renderValue(dbRow?.invoice_concept)} />
                </Section>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleDeleteInvoice}
                    disabled={!canDeleteInvoice || isDeletingInvoice}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeletingInvoice ? 'Eliminando factura...' : 'Eliminar factura'}
                  </button>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200 bg-white p-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-base font-semibold text-slate-900">Eliminar factura</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              ¿Seguro que quieres eliminar esta factura?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex-row justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              onClick={handleConfirmDelete}
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
