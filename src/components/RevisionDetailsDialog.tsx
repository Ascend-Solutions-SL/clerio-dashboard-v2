'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

export type FacturaDetails = {
  id: number;
  numero: string;
  fecha: string;
  tipo: string;
  buyer_tax_id: string | null;
  seller_tax_id: string | null;
  invoice_concept: string | null;
  importe_sin_iva: number | string | null;
  iva: number | string | null;
  importe_total: number | string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factura: FacturaDetails | null;
  onSaved?: () => void;
};

const TIPOS = ['Ingresos', 'Gastos', 'No Factura', 'Por Revisar'] as const;

export function RevisionDetailsDialog({ open, onOpenChange, factura, onSaved }: Props) {
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [answer, setAnswer] = React.useState<'si' | 'no' | null>(null);
  const [showConfirmHint, setShowConfirmHint] = React.useState(false);
  const confirmHintTimeoutRef = React.useRef<number | null>(null);

  const [form, setForm] = React.useState({
    numero: '',
    fecha: '',
    tipo: 'Por Revisar',
    clienteProveedor: '',
    concepto: '',
    importeSinIva: '',
    iva: '',
    importeTotal: '',
  });

  React.useEffect(() => {
    if (!open) {
      setAnswer(null);
      setShowConfirmHint(false);

      if (confirmHintTimeoutRef.current) {
        window.clearTimeout(confirmHintTimeoutRef.current);
        confirmHintTimeoutRef.current = null;
      }
      return;
    }

    if (!factura) {
      return;
    }

    setForm({
      numero: factura.numero ?? '',
      fecha: factura.fecha ?? '',
      tipo: (TIPOS.includes(factura.tipo as (typeof TIPOS)[number]) ? factura.tipo : 'Por Revisar') as string,
      clienteProveedor: factura.buyer_tax_id ?? factura.seller_tax_id ?? '',
      concepto: factura.invoice_concept ?? '',
      importeSinIva: factura.importe_sin_iva == null ? '' : String(factura.importe_sin_iva),
      iva: factura.iva == null ? '' : String(factura.iva),
      importeTotal: factura.importe_total == null ? '' : String(factura.importe_total),
    });
  }, [open, factura]);

  const isEditable = answer === 'si';

  const warnLocked = () => {
    setShowConfirmHint(true);
    if (confirmHintTimeoutRef.current) {
      window.clearTimeout(confirmHintTimeoutRef.current);
    }
    confirmHintTimeoutRef.current = window.setTimeout(() => {
      setShowConfirmHint(false);
      confirmHintTimeoutRef.current = null;
    }, 2500);
  };

  const parseOptionalNumber = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.replace(',', '.');
    const value = Number(normalized);
    if (!Number.isFinite(value)) {
      return undefined;
    }

    return value;
  };

  const handleSave = async () => {
    if (!factura) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (answer !== 'si') {
        const { error } = await supabase
          .from('facturas')
          .update({
            tipo: 'No Factura',
          })
          .eq('id', factura.id);

        if (error) {
          throw error;
        }

        toast({
          title: 'Guardado',
          description: 'Se ha marcado como No Factura.',
        });

        onSaved?.();
        onOpenChange(false);
        return;
      }

      const numero = String(form.numero ?? '').trim();
      const fecha = String(form.fecha ?? '').trim();
      const tipo = String(form.tipo ?? '').trim();
      const clienteProveedor = String(form.clienteProveedor ?? '').trim();
      const concepto = String(form.concepto ?? '').trim();

      if (!numero) {
        toast({
          title: 'Faltan datos',
          description: 'El campo “Número” es obligatorio.',
          variant: 'destructive',
        });
        return;
      }

      if (!fecha) {
        toast({
          title: 'Faltan datos',
          description: 'El campo “Fecha” es obligatorio.',
          variant: 'destructive',
        });
        return;
      }

      if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) {
        toast({
          title: 'Tipo inválido',
          description: 'Selecciona un tipo válido.',
          variant: 'destructive',
        });
        return;
      }

      if (!clienteProveedor) {
        toast({
          title: 'Faltan datos',
          description: 'El campo “Negocio Contraparte” es obligatorio.',
          variant: 'destructive',
        });
        return;
      }

      const importeSinIva = parseOptionalNumber(form.importeSinIva);
      if (importeSinIva === undefined) {
        toast({
          title: 'Formato incorrecto',
          description: '“Importe sin IVA” debe ser un número.',
          variant: 'destructive',
        });
        return;
      }

      const iva = parseOptionalNumber(form.iva);
      if (iva === undefined) {
        toast({
          title: 'Formato incorrecto',
          description: '“IVA” debe ser un número.',
          variant: 'destructive',
        });
        return;
      }

      const importeTotal = parseOptionalNumber(form.importeTotal);
      if (importeTotal === undefined) {
        toast({
          title: 'Formato incorrecto',
          description: '“Importe total” debe ser un número.',
          variant: 'destructive',
        });
        return;
      }

      const payload = {
        numero,
        fecha,
        tipo,
        buyer_tax_id: clienteProveedor,
        seller_tax_id: clienteProveedor,
        invoice_concept: concepto || null,
        importe_sin_iva: importeSinIva,
        iva,
        importe_total: importeTotal,
      };

      const { error } = await supabase.from('facturas').update(payload).eq('id', factura.id);

      if (error) {
        throw error;
      }

      toast({
        title: 'Guardado',
        description: 'La información se ha actualizado correctamente.',
      });

      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-20 flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="text-base font-semibold text-slate-900">Revisión del documento</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Atrás
          </Button>
          <Button
            type="button"
            className="h-9 bg-blue-600 hover:bg-blue-700"
            onClick={handleSave}
            disabled={isSubmitting || !factura}
          >
            Guardar
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-900">
              ¿Es este documento una factura/recibo/transacción que debas contabilizar?
            </div>
            <div className="relative mt-3 flex items-center gap-2">
              {showConfirmHint && !isEditable ? (
                <div className="absolute -top-12 left-0">
                  <div className="relative max-w-[260px] rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg">
                    Para rellenar los campos, primero marca “Sí”.
                    <div className="absolute -bottom-1 left-4 h-2 w-2 rotate-45 bg-slate-900" />
                  </div>
                </div>
              ) : null}
              <Button
                type="button"
                variant={answer === 'si' ? 'default' : 'outline'}
                className={`${answer === 'si' ? 'h-9 bg-slate-900 hover:bg-slate-900' : 'h-9'} ${showConfirmHint && !isEditable ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-50' : ''}`}
                onClick={() => {
                  setAnswer('si');
                  setShowConfirmHint(false);
                }}
              >
                Sí
              </Button>
              <Button
                type="button"
                variant={answer === 'no' ? 'default' : 'outline'}
                className={answer === 'no' ? 'h-9 bg-slate-900 hover:bg-slate-900' : 'h-9'}
                onClick={() => setAnswer('no')}
              >
                No
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-0.5">
              <Label>Número</Label>
              <Input
                value={form.numero}
                readOnly={!isEditable}
                onFocus={() => {
                  if (!isEditable) warnLocked();
                }}
                onChange={(e) => setForm((prev) => ({ ...prev, numero: e.target.value }))}
              />
            </div>

            <div className="space-y-0.5">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.fecha}
                readOnly={!isEditable}
                onFocus={() => {
                  if (!isEditable) warnLocked();
                }}
                onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))}
              />
            </div>

            <div className="space-y-0.5">
              <Label>Tipo</Label>
              <div
                onMouseDown={(e) => {
                  if (!isEditable) {
                    e.preventDefault();
                    warnLocked();
                  }
                }}
              >
                <Select value={form.tipo} onValueChange={(value) => setForm((prev) => ({ ...prev, tipo: value }))} disabled={!isEditable}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-0.5">
              <Label>Negocio Contraparte</Label>
              <Input
                value={form.clienteProveedor}
                readOnly={!isEditable}
                onFocus={() => {
                  if (!isEditable) warnLocked();
                }}
                onChange={(e) => setForm((prev) => ({ ...prev, clienteProveedor: e.target.value }))}
              />
            </div>

            <div className="space-y-0.5 sm:col-span-2">
              <Label>Concepto</Label>
              <Input
                value={form.concepto}
                readOnly={!isEditable}
                onFocus={() => {
                  if (!isEditable) warnLocked();
                }}
                onChange={(e) => setForm((prev) => ({ ...prev, concepto: e.target.value }))}
              />
            </div>

            <div className="space-y-0.5">
              <Label>Importe sin IVA</Label>
              <Input
                type="number"
                step="0.01"
                value={form.importeSinIva}
                readOnly={!isEditable}
                onFocus={() => {
                  if (!isEditable) warnLocked();
                }}
                onChange={(e) => setForm((prev) => ({ ...prev, importeSinIva: e.target.value }))}
              />
            </div>

            <div className="space-y-0.5">
              <Label>IVA</Label>
              <Input
                type="number"
                step="0.01"
                value={form.iva}
                readOnly={!isEditable}
                onFocus={() => {
                  if (!isEditable) warnLocked();
                }}
                onChange={(e) => setForm((prev) => ({ ...prev, iva: e.target.value }))}
              />
            </div>

            <div className="space-y-0.5 sm:col-span-2">
              <Label>Importe total</Label>
              <Input
                type="number"
                step="0.01"
                value={form.importeTotal}
                readOnly={!isEditable}
                onFocus={() => {
                  if (!isEditable) warnLocked();
                }}
                onChange={(e) => setForm((prev) => ({ ...prev, importeTotal: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default RevisionDetailsDialog;
