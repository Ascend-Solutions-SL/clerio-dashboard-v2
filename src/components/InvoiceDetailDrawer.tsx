'use client';

import * as React from 'react';
import { Download, Eye, X } from 'lucide-react';

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
  closeAnimationMs?: number;
};

export function InvoiceDetailDrawer({ row, onClose, closeAnimationMs = 260 }: InvoiceDetailDrawerProps) {
  const [isClosing, setIsClosing] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const closeDrawer = () => {
    if (isClosing) {
      return;
    }
    setIsClosing(true);
    timeoutRef.current = setTimeout(() => {
      onClose();
    }, closeAnimationMs);
  };

  const driveType = String(row.drive_type ?? '').trim();
  const driveFileId = String(row.drive_file_id ?? '').trim();
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

  const currency = row.divisa ?? 'EUR';
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
                <div className="mt-0.5 text-[12px] text-slate-500 truncate">{String(row.numero ?? '—')}</div>
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
              <div className="space-y-3">
                <Section title="Resumen">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Número" value={renderValue(row.numero)} />
                    <Field label="Fecha" value={formatShortDate(row.fecha)} />
                    <Field label="Tipo" value={renderValue(row.tipo)} />
                  </div>
                  <div className="mt-3">
                    <Field label="Contraparte" value={renderValue(row.counterparty)} />
                  </div>
                </Section>

                <Section title="Comprador">
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
                    <Field label="CIF/NIF" value={renderValue(row.buyer_tax_id)} />
                    <Field label="Nombre" value={renderValue(row.buyer_name)} />
                  </div>
                </Section>

                <Section title="Vendedor">
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
                    <Field label="CIF/NIF" value={renderValue(row.seller_tax_id)} />
                    <Field label="Nombre" value={renderValue(row.seller_name)} />
                  </div>
                </Section>

                <Section title="Importes">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="IVA" value={<span className="font-mono">{renderMoney(row.iva)}</span>} />
                    <Field label="Descuentos" value={<span className="font-mono">{renderMoney(row.descuentos)}</span>} />
                    <Field label="Retenciones" value={<span className="font-mono">{renderMoney(row.retenciones)}</span>} />
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Importe sin IVA"
                      value={<span className="font-mono font-semibold">{renderMoney(row.importe_sin_iva)}</span>}
                    />
                    <Field
                      label="Importe total"
                      value={<span className="font-mono font-semibold">{renderMoney(row.importe_total)}</span>}
                    />
                  </div>
                </Section>

                <Section title="Concepto">
                  <Field label="Descripción" value={renderValue(row.invoice_concept)} />
                </Section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
