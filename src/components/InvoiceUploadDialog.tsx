"use client";

import React, { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
const uploadWebhookUrl = "https://v-ascendsolutions.app.n8n.cloud/webhook/upload-document";

type InvoiceType = "Ingresos" | "Gastos";

type PaymentStatus = (typeof paymentStatuses)[number];
type UploadMode = "file" | "manual";

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
  const [mode, setMode] = useState<UploadMode>("file");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState<InvoiceFormState>(() => getDefaultFormState());
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setMode("file");
      setSelectedFile(null);
      setDragActive(false);
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

  const isPdfFile = (file: File) => {
    const mime = file.type?.toLowerCase() ?? "";
    if (mime === "application/pdf") {
      return true;
    }
    return file.name.toLowerCase().endsWith(".pdf");
  };

  const handleFileSelection = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!isPdfFile(file)) {
      setSelectedFile(null);
      toast({
        title: "Archivo no válido",
        description: "Solo se permiten archivos PDF.",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!user?.id) {
      toast({
        title: "No se pudo subir el archivo",
        description: "No se encontró el usuario autenticado.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.email) {
      toast({
        title: "No se pudo subir el archivo",
        description: "No se encontró el email del usuario autenticado.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile) {
      toast({
        title: "Selecciona un archivo",
        description: "Debes seleccionar un PDF antes de subir.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("data", selectedFile);
      formData.append("user_uid", user.id);
      formData.append("email", user.email);

      const response = await fetch(uploadWebhookUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error al subir el archivo (${response.status})`);
      }

      toast({
        title: "Archivo subido",
        description: "Archivo subido correctamente. Procesando documento...",
      });

      onCreated?.();
      setOpen(false);
    } catch (error) {
      toast({
        title: "No se pudo subir el archivo",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="bg-blue-600 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:translate-y-0"
          disabled={isDisabled}
        >
          + Subir {tipoLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={12}
        className="relative w-[380px] max-w-[94vw] rounded-2xl border border-slate-200/90 bg-white p-3 text-slate-900 shadow-[0_22px_50px_-22px_rgba(15,23,42,0.45)] data-[state=open]:duration-300 data-[state=closed]:duration-200 data-[state=open]:ease-out data-[state=closed]:ease-in"
      >
        <div className="absolute -top-1.5 right-8 h-3 w-3 rotate-45 rounded-[2px] border-l border-t border-slate-200/90 bg-white" />
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Registrar {tipoLabel}</h3>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-1">
            <div className="grid grid-cols-2 gap-1">
              <Button
                type="button"
                variant={mode === "file" ? "default" : "ghost"}
                className={mode === "file" ? "h-8 text-xs bg-blue-600 hover:bg-blue-700" : "h-8 text-xs"}
                onClick={() => setMode("file")}
              >
                Subir archivo
              </Button>
              <Button
                type="button"
                variant={mode === "manual" ? "default" : "ghost"}
                className="h-8 text-xs"
                onClick={() => setMode("manual")}
              >
                Introducir manualmente
              </Button>
            </div>
          </div>

          {mode === "file" ? (
            <div className="space-y-4">
              <div
                role="button"
                tabIndex={0}
                className={`flex min-h-[140px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
                  dragActive ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-300 bg-slate-100 text-slate-700"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  const droppedFile = event.dataTransfer.files?.[0] ?? null;
                  handleFileSelection(droppedFile);
                }}
              >
                <div className="space-y-2">
                  <p className="font-medium">Arrastra un PDF aquí o haz click para seleccionarlo</p>
                  {selectedFile ? <p className="text-xs text-slate-600">{selectedFile.name}</p> : null}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  const pickedFile = event.target.files?.[0] ?? null;
                  handleFileSelection(pickedFile);
                  event.currentTarget.value = "";
                }}
              />

              <div className="flex justify-end">
                <Button type="button" onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Subiendo...
                    </>
                  ) : (
                    "Subir"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 [&_label]:text-[11px] [&_input]:h-8 [&_input]:text-xs">
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
                    <SelectTrigger className="h-8 text-xs">
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

              <div className="flex justify-end">
                <Button type="submit" disabled={submitting || isDisabled} className="bg-blue-600 hover:bg-blue-700">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    "Guardar factura"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default InvoiceUploadDialog;
