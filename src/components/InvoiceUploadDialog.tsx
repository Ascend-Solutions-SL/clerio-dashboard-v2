"use client";

import React, { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardSession } from "@/context/dashboard-session-context";
import { useFinancialData } from "@/context/FinancialDataContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

const paymentStatuses = ["Pagada", "Pendiente", "Cancelada"] as const;

type InvoiceType = "Ingresos" | "Gastos";

type PaymentStatus = (typeof paymentStatuses)[number];

type InvoiceFormState = {
  numero: string;
  fecha: string;
  cliente_proveedor: string;
  concepto: string;
  importe_sin_iva: string;
  iva: string;
  estado_pago: PaymentStatus;
};

const getDefaultFormState = (): InvoiceFormState => ({
  numero: "",
  fecha: "",
  cliente_proveedor: "",
  concepto: "",
  importe_sin_iva: "",
  iva: "",
  estado_pago: "Pendiente",
});

const parseManualDate = (value: string): string | null => {
  const sanitized = value.trim();
  const match = sanitized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return iso;
};

const formatDateInput = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

interface InvoiceUploadDialogProps {
  type: InvoiceType;
  onCreated?: () => void;
}

export const InvoiceUploadDialog: React.FC<InvoiceUploadDialogProps> = ({ type, onCreated }) => {
  const { user } = useDashboardSession();
  const empresaId = user?.empresaId ? Number(user?.empresaId) : null;
  const empresaNombre = user?.businessName?.trim() || "Sin empresa";
  const { refresh: refreshFinancialData } = useFinancialData();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<InvoiceFormState>(() => getDefaultFormState());

  React.useEffect(() => {
    if (!open) {
      setForm(getDefaultFormState());
    }
  }, [open]);

  const tipoLabel = useMemo(() => (type === "Ingresos" ? "ingreso" : "gasto"), [type]);
  const businessName = user?.businessName?.trim() || '';
  const isDisabled = !businessName;

  const handleInputChange = (
    field: keyof InvoiceFormState,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (rawValue: string) => {
    const formatted = formatDateInput(rawValue);
    setForm((prev) => ({ ...prev, fecha: formatted }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isDisabled) {
      toast({
        title: "No se pudo crear la factura",
        description: "El usuario no tiene una empresa asociada.",
        variant: "destructive",
      });
      return;
    }

    const isoDate = parseManualDate(form.fecha);

    if (!form.numero.trim() || !isoDate || !form.cliente_proveedor.trim()) {
      toast({
        title: "Faltan datos obligatorios",
        description: "Completa número, fecha (dd/mm/aaaa) y cliente/proveedor.",
        variant: "destructive",
      });
      return;
    }

    const importeSinIva = Number.parseFloat(form.importe_sin_iva || "0");
    const iva = Number.parseFloat(form.iva || "0");
    const importeTotal = (Number.isFinite(importeSinIva) ? importeSinIva : 0) + (Number.isFinite(iva) ? iva : 0);

    setSubmitting(true);
    try {
      const counterpartTaxId = form.cliente_proveedor.trim();
      const { error } = await supabase.from("facturas").insert({
        numero: form.numero.trim(),
        fecha: isoDate,
        tipo: type,
        source: 'manual',
        empresa_id: empresaId,
        user_businessname: businessName,
        buyer_tax_id: type === 'Ingresos' ? counterpartTaxId : null,
        seller_tax_id: type === 'Gastos' ? counterpartTaxId : null,
        invoice_concept: form.concepto.trim() || null,
        importe_sin_iva: Number.isFinite(importeSinIva) ? importeSinIva : null,
        iva: Number.isFinite(iva) ? iva : null,
        importe_total: Number.isFinite(importeTotal) ? importeTotal : null,
        drive_file_id: null,
        drive_file_name: null,
      });

      if (error) throw error;

      toast({
        title: "Factura creada",
        description: "La factura se guardó correctamente.",
      });

      await refreshFinancialData();
      onCreated?.();
      setOpen(false);
    } catch (error) {
      console.error("Error creating invoice", error);
      toast({
        title: "No se pudo crear la factura",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => !isDisabled && setOpen(true)}
          disabled={isDisabled}
        >
          + Subir {tipoLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Registrar {tipoLabel}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Número *</Label>
              <Input
                value={form.numero}
                onChange={(event) => handleInputChange("numero", event.target.value)}
                placeholder="2025-INV-001"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Fecha *</Label>
              <Input
                type="text"
                value={form.fecha}
                onChange={(event) => handleDateChange(event.target.value)}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
                pattern="\d{2}/\d{2}/\d{4}"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Cliente / Proveedor *</Label>
              <Input
                value={form.cliente_proveedor}
                onChange={(event) => handleInputChange("cliente_proveedor", event.target.value)}
                placeholder="Nombre o razón social"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Concepto</Label>
              <Input
                value={form.concepto}
                onChange={(event) => handleInputChange("concepto", event.target.value)}
                placeholder="Descripción corta"
              />
            </div>
            <div className="space-y-1">
              <Label>Importe sin IVA *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.importe_sin_iva}
                onChange={(event) => handleInputChange("importe_sin_iva", event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>IVA *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.iva}
                onChange={(event) => handleInputChange("iva", event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Importe total</Label>
              <Input
                value={(() => {
                  const base = Number.parseFloat(form.importe_sin_iva || "0");
                  const tax = Number.parseFloat(form.iva || "0");
                  const total = (Number.isFinite(base) ? base : 0) + (Number.isFinite(tax) ? tax : 0);
                  return total.toFixed(2);
                })()}
                disabled
                className="bg-gray-100 text-gray-600"
              />
            </div>
            <div className="space-y-1">
              <Label>Estado de pago *</Label>
              <Select
                value={form.estado_pago}
                onValueChange={(value) => handleInputChange("estado_pago", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Empresa</Label>
              <Input
                value={empresaNombre}
                disabled
                className="bg-gray-100 text-gray-500"
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Input value={type} disabled className="bg-gray-100 text-gray-500" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || isDisabled} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                "Guardar factura"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceUploadDialog;
