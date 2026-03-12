'use client';
import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';

type DriveType = 'googledrive' | 'onedrive';

type FacturaRow = {
  id: number;
  numero: string;
  fecha: string;
  tipo: string;
  buyer_name?: string | null;
  buyer_tax_id: string | null;
  seller_name?: string | null;
  seller_tax_id: string | null;
  invoice_concept: string | null;
  importe_sin_iva: number | string | null;
  iva: number | string | null;
  descuentos?: number | string | null;
  retenciones?: number | string | null;
  importe_total: number | string | null;
  factura_uid: string | null;
  invoice_reason: string | null;
  factura_validada?: boolean | null;
  reviewed_at?: string | null;
  drive_file_id?: string | null;
  drive_type?: DriveType | string | null;
};

const formatRelativeTime = (iso: string) => {
  const target = new Date(iso);
  const diffMs = Date.now() - target.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (!Number.isFinite(diffSec)) {
    return '';
  }

  const abs = Math.abs(diffSec);
  if (abs < 60) {
    return 'Ahora';
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return `Hace ${diffMin} min`;
  }
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) {
    return `Hace ${diffHour} h`;
  }
  const diffDay = Math.round(diffHour / 24);
  if (diffDay === 1) {
    return 'ayer';
  }
  if (diffDay < 7) {
    return `Hace ${diffDay} días`;
  }
  return target.toLocaleDateString();
};

type RevisionRow = {
  id: number;
  invoice_uid: string;
  rawDate: string;
  tipo: string;
  numero: string;
  buyerName: string;
  buyerTaxId: string;
  sellerName: string;
  sellerTaxId: string;
  concepto: string;
  importeSinIva: number | string | null;
  iva: number | string | null;
  descuentos: number | string | null;
  retenciones: number | string | null;
  importeTotal: number | string | null;
  reviewed: boolean;
  reviewedAt: string | null;
  driveFileId: string | null;
  driveType: DriveType | null;
};

const formatDate = (raw: string) => {
  if (!raw) {
    return '';
  }
  return raw;
};

const resolveContraparte = (row: RevisionRow) => {
  if (row.tipo === 'Ingresos') {
    return row.buyerName || '—';
  }

  if (row.tipo === 'Gastos') {
    return row.sellerName || '—';
  }

  if (row.tipo === 'Por Revisar') {
    return 'Por Revisar';
  }

  if (row.tipo === 'No Factura') {
    return 'No Factura';
  }

  return row.buyerName || row.sellerName || '—';
};

const getTipoBadgeClasses = (tipo: string) => {
  if (tipo === 'Por Revisar') {
    return 'bg-amber-100 text-amber-950 border-amber-300';
  }

  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const getRowClasses = (tipo: string) => {
  if (tipo === 'Por Revisar') {
    return 'bg-amber-50/40';
  }

  if (tipo === 'No Factura') {
    return 'bg-violet-50/40';
  }

  return '';
};

const getSelectedRowClasses = (selected: boolean) => {
  if (!selected) {
    return '';
  }

  return 'bg-blue-50 ring-2 ring-inset ring-blue-200';
};

interface RevisionsTableProps {
  onPorRevisarCountChange?: (count: number) => void;
  onNoFacturasCountChange?: (count: number) => void;
  onHistoricoCountChange?: (count: number) => void;
  selectedId?: number | null;
  onSelect?: (id: number, row: RevisionRow) => void;
  onDataLoaded?: (rows: RevisionRow[]) => void;
  refreshKey?: number;
  scope?: 'pending' | 'history';
  onScopeChange?: (scope: 'pending' | 'history') => void;
}

export function RevisionsTable({
  onPorRevisarCountChange,
  onNoFacturasCountChange,
  onHistoricoCountChange,
  selectedId = null,
  onSelect,
  onDataLoaded,
  refreshKey = 0,
  scope: scopeProp,
  onScopeChange,
}: RevisionsTableProps) {
  const { toast } = useToast();
  const { user, isLoading } = useDashboardSession();
  const [data, setData] = React.useState<RevisionRow[]>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [tipoFilter, setTipoFilter] = React.useState<'all' | 'Ingresos' | 'Gastos' | 'Por Revisar' | 'No Factura'>('all');
  const [mode, setMode] = React.useState<'list' | 'review'>('list');
  const [scopeState, setScopeState] = React.useState<'pending' | 'history'>('pending');

  const [period, setPeriod] = React.useState<'total' | 'month' | 'quarter' | 'year' | 'custom'>('total');
  const [customRange, setCustomRange] = React.useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });

  const [dateSort, setDateSort] = React.useState<null | 'asc' | 'desc'>(null);

  const periodRange = React.useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (period === 'total') {
      return null;
    }

    if (period === 'custom') {
      const start = customRange.startDate?.trim() || '';
      const end = customRange.endDate?.trim() || '';
      return start && end ? { start, end } : null;
    }

    if (period === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = now;
      return { start: toIsoDate(start), end: toIsoDate(end) };
    }

    if (period === 'quarter') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterStartMonth, 1);
      const end = now;
      return { start: toIsoDate(start), end: toIsoDate(end) };
    }

    // month
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = now;
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }, [customRange.endDate, customRange.startDate, period]);

  const [reviewForm, setReviewForm] = React.useState({
    numero: '',
    fecha: '',
    tipo: 'Por Revisar',
    buyerName: '',
    buyerTaxId: '',
    sellerName: '',
    sellerTaxId: '',
    iva: '',
    descuentos: '',
    retenciones: '',
    importeSinIva: '',
    importeTotal: '',
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [nfUnlock, setNfUnlock] = React.useState(false);
  const [nfConfirmStep, setNfConfirmStep] = React.useState<0 | 1>(0);
  const [validateConfirmStep, setValidateConfirmStep] = React.useState<0 | 1>(0);
  const [showAmountsMismatchConfirm, setShowAmountsMismatchConfirm] = React.useState(false);
  const [amountsMismatchAccepted, setAmountsMismatchAccepted] = React.useState(false);
  const [showAmountsMismatchHint, setShowAmountsMismatchHint] = React.useState(false);
  const amountsMismatchAcceptedRef = React.useRef(false);
  const validateConfirmTimeoutRef = React.useRef<number | null>(null);
  const [realtimeRefreshKey, setRealtimeRefreshKey] = React.useState(0);
  const realtimeDebounceRef = React.useRef<number | null>(null);

  const businessName = user?.businessName?.trim() || '';
  const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;

  const scope = scopeProp ?? scopeState;

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    if (empresaId == null && !businessName) {
      return;
    }

    const filter = empresaId != null ? `empresa_id=eq.${empresaId}` : `user_businessname=eq.${businessName}`;
    const channel = supabase
      .channel(`revisions-facturas-${empresaId ?? businessName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'facturas',
          filter,
        },
        () => {
          if (realtimeDebounceRef.current) {
            window.clearTimeout(realtimeDebounceRef.current);
          }
          realtimeDebounceRef.current = window.setTimeout(() => {
            setRealtimeRefreshKey((prev) => prev + 1);
            realtimeDebounceRef.current = null;
          }, 400);
        }
      );

    channel.subscribe();

    return () => {
      if (realtimeDebounceRef.current) {
        window.clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [businessName, empresaId, isLoading]);

  React.useEffect(() => {
    if (scopeProp) {
      setScopeState(scopeProp);
    }
  }, [scopeProp]);

  const selected = React.useMemo(() => data.find((r) => r.id === selectedId) ?? null, [data, selectedId]);

  React.useEffect(() => {
    if (!selected && mode !== 'list') {
      setMode('list');
    }
  }, [selected, mode]);

  React.useEffect(() => {
    if (!selected) {
      return;
    }

    setNfConfirmStep(0);
    setShowAmountsMismatchHint(false);
    setAmountsMismatchAccepted(false);
    amountsMismatchAcceptedRef.current = false;
    const isNoFactura = selected.tipo === 'No Factura';
    setNfUnlock(!isNoFactura);

    setReviewForm({
      numero: selected.numero ?? '',
      fecha: selected.rawDate ?? '',
      tipo: selected.tipo ?? 'Por Revisar',
      buyerName: selected.buyerName ?? '',
      buyerTaxId: selected.buyerTaxId ?? '',
      sellerName: selected.sellerName ?? '',
      sellerTaxId: selected.sellerTaxId ?? '',
      iva: selected.iva == null ? '' : String(selected.iva),
      descuentos: selected.descuentos == null ? '' : String(selected.descuentos),
      retenciones: selected.retenciones == null ? '' : String(selected.retenciones),
      importeSinIva: selected.importeSinIva == null ? '' : String(selected.importeSinIva),
      importeTotal: selected.importeTotal == null ? '' : String(selected.importeTotal),
    });
  }, [selected]);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!businessName && empresaId == null) {
      setData([]);
      onPorRevisarCountChange?.(0);
      onNoFacturasCountChange?.(0);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      let query = supabase
        .from('facturas')
        .select(
          'id, numero, fecha, tipo, buyer_name, buyer_tax_id, seller_name, seller_tax_id, invoice_concept, importe_sin_iva, iva, descuentos, retenciones, importe_total, factura_uid, invoice_reason, factura_validada, reviewed_at, drive_file_id, drive_type'
        )
        .eq('factura_validada', scope === 'pending' ? false : true);

      query = query.order('fecha', { ascending: false });

      if (empresaId != null && businessName) {
        query = query.or(`empresa_id.eq.${empresaId},user_businessname.eq.${businessName}`);
      } else {
        query = empresaId != null ? query.eq('empresa_id', empresaId) : query.eq('user_businessname', businessName);
      }

      if (tipoFilter !== 'all') {
        query = query.eq('tipo', tipoFilter);
      }

      if (periodRange) {
        query = query.gte('fecha', periodRange.start).lte('fecha', periodRange.end);
      }

      const makeCountQuery = (reviewed: boolean) => {
        let countQuery = supabase
          .from('facturas')
          .select('id', { count: 'exact', head: true })
          .eq('factura_validada', reviewed);

        if (empresaId != null) {
          countQuery = countQuery.eq('empresa_id', empresaId);
        } else if (businessName) {
          // Fallback (shouldn't happen in your system, but keeps behavior safe)
          countQuery = countQuery.eq('user_businessname', businessName);
        }

        if (tipoFilter !== 'all') {
          countQuery = countQuery.eq('tipo', tipoFilter);
        }

        if (periodRange) {
          countQuery = countQuery.gte('fecha', periodRange.start).lte('fecha', periodRange.end);
        }

        return countQuery;
      };

      const [{ data: rows, error }, pendingCountRes, historyCountRes] = await Promise.all([
        query,
        makeCountQuery(false),
        makeCountQuery(true),
      ]);

      if (!isMounted) {
        return;
      }

      if (error || !rows) {
        setData([]);
        onPorRevisarCountChange?.(pendingCountRes.count ?? 0);
        onNoFacturasCountChange?.(0);
        onHistoricoCountChange?.(historyCountRes.count ?? 0);
        return;
      }

      const typedRows = rows as FacturaRow[];

      const noFacturasCount = scope === 'pending' ? typedRows.filter((r) => r.tipo === 'No Factura').length : 0;

      onPorRevisarCountChange?.(pendingCountRes.count ?? 0);
      onNoFacturasCountChange?.(noFacturasCount);
      onHistoricoCountChange?.(historyCountRes.count ?? 0);

      // Emit real-time count update for sidebar badge
      window.dispatchEvent(new CustomEvent('revisions-count-updated', { detail: { pending: pendingCountRes.count ?? 0 } }));

      const mapped: RevisionRow[] = typedRows.map((row) => {
        const resolvedDriveType =
          row.drive_type === 'onedrive' || row.drive_type === 'googledrive' ? (row.drive_type as DriveType) : null;

        return {
          id: row.id,
          invoice_uid: row.factura_uid ?? '',
          rawDate: row.fecha,
          tipo: row.tipo,
          numero: row.numero,
          buyerName: row.buyer_name ?? '',
          buyerTaxId: row.buyer_tax_id ?? '',
          sellerName: row.seller_name ?? '',
          sellerTaxId: row.seller_tax_id ?? '',
          concepto: row.invoice_concept ?? '',
          importeSinIva: row.importe_sin_iva ?? null,
          iva: row.iva ?? null,
          descuentos: row.descuentos ?? null,
          retenciones: row.retenciones ?? null,
          importeTotal: row.importe_total ?? null,
          reviewed: Boolean(row.factura_validada),
          reviewedAt: row.reviewed_at ?? null,
          driveFileId: row.drive_file_id ?? null,
          driveType: resolvedDriveType,
        };
      });

      setData(mapped);
      onDataLoaded?.(mapped);
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [
    isLoading,
    businessName,
    empresaId,
    tipoFilter,
    period,
    customRange.startDate,
    customRange.endDate,
    refreshKey,
    realtimeRefreshKey,
    scope,
    onPorRevisarCountChange,
    onNoFacturasCountChange,
    onHistoricoCountChange,
  ]);

  const advanceToNext = React.useCallback(
    (currentId: number) => {
      const idx = data.findIndex((r) => r.id === currentId);
      const next = idx >= 0 ? data[idx + 1] ?? data[idx - 1] ?? null : data[0] ?? null;

      if (next) {
        onSelect?.(next.id, next);
      }
    },
    [data, onSelect]
  );

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

  const amountsCheck = React.useMemo(() => {
    const base = parseOptionalNumber(reviewForm.importeSinIva);
    const iva = parseOptionalNumber(reviewForm.iva);
    const descuentos = parseOptionalNumber(reviewForm.descuentos);
    const retenciones = parseOptionalNumber(reviewForm.retenciones);
    const total = parseOptionalNumber(reviewForm.importeTotal);

    const anyInvalid =
      base === undefined || iva === undefined || descuentos === undefined || retenciones === undefined || total === undefined;
    if (anyInvalid) {
      return { status: 'invalid' as const, expected: null as number | null };
    }

    if (base === null || iva === null || total === null) {
      return { status: 'missing' as const, expected: null as number | null };
    }

    const expected = base + iva - (descuentos ?? 0) - (retenciones ?? 0);
    const equal = Math.abs(expected - total) < 0.005;
    const status: 'ok' | 'mismatch' = equal ? 'ok' : 'mismatch';
    return { status, expected };
  }, [reviewForm.descuentos, reviewForm.importeSinIva, reviewForm.importeTotal, reviewForm.iva, reviewForm.retenciones]);

  React.useEffect(() => {
    if (!showAmountsMismatchHint) {
      return;
    }

    if (amountsCheck.status !== 'mismatch') {
      setShowAmountsMismatchHint(false);
    }
  }, [amountsCheck.status, showAmountsMismatchHint]);

  const handleValidateAndNext = async () => {
    if (!selected) {
      return;
    }

    if (validateConfirmStep === 0) {
      if (amountsCheck.status === 'mismatch') {
        setShowAmountsMismatchHint(true);
      }
      setAmountsMismatchAccepted(false);
      amountsMismatchAcceptedRef.current = false;
      setValidateConfirmStep(1);
      if (validateConfirmTimeoutRef.current) {
        window.clearTimeout(validateConfirmTimeoutRef.current);
      }
      validateConfirmTimeoutRef.current = window.setTimeout(() => {
        setValidateConfirmStep(0);
        validateConfirmTimeoutRef.current = null;
      }, 3500);
      return;
    }

    if (amountsCheck.status === 'mismatch' && !amountsMismatchAcceptedRef.current) {
      setShowAmountsMismatchConfirm(true);
      return;
    }

    if (selected.tipo === 'No Factura' && !nfUnlock) {
      return;
    }

    setIsSaving(true);
    try {
      const numero = String(reviewForm.numero ?? '').trim();
      const fecha = String(reviewForm.fecha ?? '').trim();
      const tipo = String(reviewForm.tipo ?? '').trim();
      const buyerName = String(reviewForm.buyerName ?? '').trim();
      const buyerTaxId = String(reviewForm.buyerTaxId ?? '').trim();
      const sellerName = String(reviewForm.sellerName ?? '').trim();
      const sellerTaxId = String(reviewForm.sellerTaxId ?? '').trim();

      if (!numero || !fecha) {
        toast({
          title: 'Faltan datos',
          description: 'Revisa “Número” y “Fecha” antes de validar.',
          variant: 'destructive',
        });
        return;
      }

      const importeSinIva = parseOptionalNumber(reviewForm.importeSinIva);
      if (importeSinIva === undefined) {
        toast({
          title: 'Formato incorrecto',
          description: '“Importe sin IVA” debe ser un número.',
          variant: 'destructive',
        });
        return;
      }
      const iva = parseOptionalNumber(reviewForm.iva);
      if (iva === undefined) {
        toast({
          title: 'Formato incorrecto',
          description: '“IVA” debe ser un número.',
          variant: 'destructive',
        });
        return;
      }
      const descuentos = parseOptionalNumber(reviewForm.descuentos);
      if (descuentos === undefined) {
        toast({
          title: 'Formato incorrecto',
          description: '“Descuentos” debe ser un número.',
          variant: 'destructive',
        });
        return;
      }

      const retenciones = parseOptionalNumber(reviewForm.retenciones);
      if (retenciones === undefined) {
        toast({
          title: 'Formato incorrecto',
          description: '“Retenciones” debe ser un número.',
          variant: 'destructive',
        });
        return;
      }
      const importeTotal = parseOptionalNumber(reviewForm.importeTotal);
      if (importeTotal === undefined) {
        toast({
          title: 'Formato incorrecto',
          description: '“Importe total” debe ser un número.',
          variant: 'destructive',
        });
        return;
      }

      const userUid = user?.id ?? null;
      if (!userUid) {
        toast({
          title: 'Sesión no válida',
          description: 'No se ha podido obtener el usuario autenticado.',
          variant: 'destructive',
        });
        return;
      }

      const webhookPayload = {
        user_uid: userUid,
        factura_id: selected.id,
        invoice_uid: selected.invoice_uid,
        numero,
        fecha,
        tipo,
        buyer_name: buyerName || null,
        buyer_tax_id: buyerTaxId || null,
        seller_name: sellerName || null,
        seller_tax_id: sellerTaxId || null,
        importe_sin_iva: importeSinIva,
        iva,
        descuentos,
        retenciones,
        importe_total: importeTotal,
      };

      const webhookRes = await fetch('https://v-ascendsolutions.app.n8n.cloud/webhook/validacion-factura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!webhookRes.ok) {
        const text = await webhookRes.text().catch(() => '');
        throw new Error(text || `Webhook error (${webhookRes.status})`);
      }

      toast({
        title: 'Enviado',
        description: 'La validación se ha enviado correctamente.',
      });

      advanceToNext(selected.id);
    } catch (error) {
      console.error('Error validando factura (webhook)', error);
      toast({
        title: 'No se pudo validar la factura',
        description: 'Inténtalo de nuevo. Si el problema persiste, contacta con soporte en hola@clerio.es',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setValidateConfirmStep(0);
      setShowAmountsMismatchConfirm(false);
      if (validateConfirmTimeoutRef.current) {
        window.clearTimeout(validateConfirmTimeoutRef.current);
        validateConfirmTimeoutRef.current = null;
      }
    }
  };

  const clearAmountsMismatchFlow = () => {
    setShowAmountsMismatchConfirm(false);
    setAmountsMismatchAccepted(false);
    amountsMismatchAcceptedRef.current = false;
    setShowAmountsMismatchHint(false);
    setValidateConfirmStep(0);
    if (validateConfirmTimeoutRef.current) {
      window.clearTimeout(validateConfirmTimeoutRef.current);
      validateConfirmTimeoutRef.current = null;
    }
  };

  const handleNoFacturaConfirm = async () => {
    if (!selected) {
      return;
    }

    setIsSaving(true);
    try {
      const reviewedAt = new Date().toISOString();
      const { data: updatedRows, error } = await supabase
        .from('facturas')
        .update({ tipo: 'No Factura', factura_validada: true, reviewed_at: reviewedAt })
        .eq('id', selected.id)
        .select('id');
      if (error) {
        throw error;
      }

      if (!updatedRows || updatedRows.length === 0) {
        toast({
          title: 'No se pudo guardar',
          description:
            'No se ha actualizado ninguna fila. Normalmente es un problema de permisos (RLS) o de que la factura no coincide con tu empresa/usuario.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Validada',
        description: 'Se ha marcado como No Factura.',
      });

      const idx = data.findIndex((r) => r.id === selected.id);
      const next = idx >= 0 ? data[idx + 1] ?? data[idx - 1] ?? null : data[0] ?? null;

      setData((prev) => {
        if (scope === 'pending') {
          return prev.filter((r) => r.id !== selected.id);
        }
        return prev.map((r) => (r.id === selected.id ? { ...r, reviewedAt, reviewed: true } : r));
      });
      if (next) {
        setNfConfirmStep(0);
        setShowAmountsMismatchHint(false);
        setAmountsMismatchAccepted(false);
        amountsMismatchAcceptedRef.current = false;
        setNfUnlock(next.tipo !== 'No Factura');
        onSelect?.(next.id, next);
        setMode('review');
      } else if (scope === 'pending') {
        setNfUnlock(true);
        setMode('list');
      }
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setNfConfirmStep(0);
    }
  };

  const resetFilters = () => {
    setTipoFilter('all');
    setGlobalFilter('');
  };

  const hasActiveFilters = tipoFilter !== 'all';

  const columns = React.useMemo<ColumnDef<RevisionRow>[]>(() => {
    const base: ColumnDef<RevisionRow>[] = [
      {
        id: 'tipo',
        header: () => <div className="text-center font-semibold">Tipo</div>,
        cell: ({ row }) => {
          const tipo = row.original.tipo;

          return (
            <div className="flex justify-center">
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getTipoBadgeClasses(
                  tipo
                )}`}
              >
                {tipo === 'No Factura' ? 'No factura' : tipo}
              </span>
            </div>
          );
        },
        size: 120,
      },
      {
        id: 'fecha',
        header: () => (
          <button
            type="button"
            className="w-full flex items-center justify-center gap-1 font-semibold"
            onClick={() =>
              setDateSort((prev) => {
                if (prev === null) {
                  return 'asc';
                }
                return prev === 'asc' ? 'desc' : null;
              })
            }
          >
            Fecha
            <span aria-hidden className={`text-xs ${dateSort ? 'text-gray-700' : 'text-gray-300'}`}>
              {dateSort === 'asc' ? '↑' : dateSort === 'desc' ? '↓' : '↕'}
            </span>
          </button>
        ),
        cell: ({ row }) => <div className="text-center tabular-nums">{formatDate(row.original.rawDate ?? '') || '—'}</div>,
        size: 105,
      },
      {
        id: 'contraparte',
        header: () => <div className="text-center font-semibold">Contraparte</div>,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <span className="block max-w-full truncate text-center font-medium text-slate-900">
              {resolveContraparte(row.original)}
            </span>
          </div>
        ),
        size: 9999,
      },
      {
        id: 'importe',
        header: () => <div className="text-center font-semibold">Importe (EUR)</div>,
        cell: ({ row }) => {
          const raw = row.original.importeTotal;
          const value = raw == null || raw === '' ? null : Number(String(raw).replace(',', '.'));
          return (
            <div className="text-center tabular-nums">
              {Number.isFinite(value as number)
                ? `${(value as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                : '—'}
            </div>
          );
        },
        size: 120,
      },
    ];

    if (scope === 'history') {
      base.push({
        id: 'reviewedAt',
        header: () => <div className="text-center font-semibold">Revisada</div>,
        cell: ({ row }) => (
          <div className="text-center tabular-nums">{row.original.reviewedAt ? formatRelativeTime(row.original.reviewedAt) : '—'}</div>
        ),
        size: 124,
      });
    }

    return base;
  }, [scope, dateSort]);

  const sortedData = React.useMemo(() => {
    const tipoRank: Record<string, number> = {
      'No Factura': 0,
      'Por Revisar': 1,
      Ingresos: 2,
      Gastos: 3,
    };

    const copy = data.map((row, idx) => ({ row, idx }));
    copy.sort((a, b) => {
      if (dateSort) {
        const aTime = a.row.rawDate ? new Date(a.row.rawDate).getTime() : 0;
        const bTime = b.row.rawDate ? new Date(b.row.rawDate).getTime() : 0;
        const diff = aTime - bTime;
        return dateSort === 'asc' ? diff : -diff;
      }

      const aRank = tipoRank[a.row.tipo] ?? 99;
      const bRank = tipoRank[b.row.tipo] ?? 99;
      if (aRank !== bRank) {
        return aRank - bRank;
      }

      // Preserve server order within same tipo when dateSort is not active
      return a.idx - b.idx;
    });
    return copy.map((x) => x.row);
  }, [data, dateSort]);

  const table = useReactTable({
    data: sortedData,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    defaultColumn: {
      minSize: 0,
      size: Number.MAX_SAFE_INTEGER,
      maxSize: Number.MAX_SAFE_INTEGER,
    },
  });

  return (
    <div
      className={`relative h-full flex flex-col overflow-hidden p-4 rounded-lg border text-sm ${
        scope === 'history' ? 'bg-slate-50 border-slate-300' : 'bg-white border-gray-200'
      }`}
    >
      {showAmountsMismatchConfirm ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/20 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="text-sm font-semibold text-slate-900">Importes no cuadran</div>
            <div className="mt-2 text-sm text-slate-700">
              El check de importes da un valor distinto al “Importe total”.
            </div>
            {amountsCheck.status === 'mismatch' && amountsCheck.expected != null ? (
              <div className="mt-2 text-sm text-slate-700">
                Suma = <span className="font-mono font-semibold">{amountsCheck.expected.toFixed(2)}€</span>
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" className="h-8 text-xs" onClick={clearAmountsMismatchFlow}>
                Atrás
              </Button>
              <Button
                type="button"
                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs"
                onClick={() => {
                  setAmountsMismatchAccepted(true);
                  amountsMismatchAcceptedRef.current = true;
                  setShowAmountsMismatchConfirm(false);
                  void handleValidateAndNext();
                }}
              >
                Aceptar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'list' ? (
        <div className="flex flex-col gap-2 mb-3">
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Tipo</div>
                <div className="w-[96px]">
                  <Select value={tipoFilter} onValueChange={(value) => setTipoFilter(value as typeof tipoFilter)}>
                    <SelectTrigger className="h-6 px-2 text-[11px] w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="Ingresos">Ingresos</SelectItem>
                      <SelectItem value="Gastos">Gastos</SelectItem>
                      <SelectItem value="Por Revisar">Por Revisar</SelectItem>
                      <SelectItem value="No Factura">No factura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Período</div>
                <div className="w-[120px]">
                  <Select value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
                    <SelectTrigger className="h-6 px-2 text-[11px] w-full">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total</SelectItem>
                      <SelectItem value="month">Mes actual</SelectItem>
                      <SelectItem value="quarter">Trimestre actual</SelectItem>
                      <SelectItem value="year">Año actual</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {period === 'custom' ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="h-7 px-2 text-xs"
                    value={customRange.startDate}
                    onChange={(e) => setCustomRange((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                  <span className="text-xs text-slate-400">—</span>
                  <Input
                    type="date"
                    className="h-7 px-2 text-xs"
                    value={customRange.endDate}
                    onChange={(e) => setCustomRange((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              ) : null}
            </div>
            <div className="w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar..."
                  className="w-full rounded-lg bg-background pl-7 md:w-[150px] h-6 text-[11px]"
                  value={globalFilter ?? ''}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 mb-3">
          <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setMode('list')}>
            Volver a la lista
          </Button>
          <Button
            type="button"
            className={
              validateConfirmStep === 0
                ? 'h-8 bg-emerald-600 hover:bg-emerald-700 text-xs'
                : 'h-8 bg-amber-600 hover:bg-amber-700 text-xs ring-2 ring-amber-300'
            }
            disabled={!selected || isSaving || (selected?.tipo === 'No Factura' && !nfUnlock)}
            onClick={() => void handleValidateAndNext()}
          >
            {validateConfirmStep === 0 ? 'Validar y siguiente' : 'Confirmar'}
          </Button>
        </div>
      )}

      <style jsx global>{`
        .revisions-table {
          table-layout: fixed;
          width: 100%;
        }

        .revisions-table th,
        .revisions-table td {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 0.625rem 0.75rem;
          text-align: center;
        }

        .revisions-table th:nth-child(1),
        .revisions-table td:nth-child(1) {
          width: 120px;
          min-width: 120px;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
        }

        .revisions-table th:nth-child(2),
        .revisions-table td:nth-child(2) {
          width: 105px;
          min-width: 105px;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
        }

        .revisions-table th:nth-child(3),
        .revisions-table td:nth-child(3) {
          width: 44%;
          min-width: 220px;
        }

        .revisions-table th:nth-child(4),
        .revisions-table td:nth-child(4) {
          width: 120px;
          min-width: 120px;
        }

        .revisions-table th:nth-child(5),
        .revisions-table td:nth-child(5) {
          width: 124px;
          min-width: 124px;
        }
      `}</style>

      {mode === 'list' ? (
        <div className="flex-1 min-h-0 rounded-md border overflow-hidden">
          <div className="h-full overflow-y-auto">
            <Table className="revisions-table text-xs">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="truncate">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`${row.original.id === selectedId ? getSelectedRowClasses(true) : getRowClasses(row.original.tipo)} cursor-pointer`}
                    onClick={() => {
                      onSelect?.(row.original.id, row.original);
                      setMode('review');
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="truncate">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 overflow-y-auto rounded-md border border-slate-200 bg-white p-3">
          {selected?.tipo === 'No Factura' && !nfUnlock ? (
            <div className="absolute inset-0 z-10 bg-slate-950/24 backdrop-blur-sm">
              <div className="flex h-full items-start justify-center px-3">
                <div className="mt-14 w-full max-w-md rounded-lg bg-white px-3 py-2 text-center shadow-lg">
                  <div className="text-xs font-semibold text-slate-900">
                    ¿Es un documento que debas contabilizar?
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      className="h-7 bg-slate-900 hover:bg-slate-900 text-xs"
                      onClick={() => {
                        setNfUnlock(true);
                        setNfConfirmStep(0);
                        setReviewForm((prev) => ({ ...prev, tipo: 'Por Revisar' }));
                      }}
                    >
                      Sí
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={isSaving}
                      onClick={() => void handleNoFacturaConfirm()}
                    >
                      No
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {selected ? (
            <div className="mt-3 relative overflow-hidden rounded-md">
              <div className={selected.tipo === 'No Factura' && !nfUnlock ? 'pointer-events-none blur-[1px] select-none' : ''}>
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <div className="pl-1 text-xs font-medium text-slate-600">Número</div>
                      <Input
                        className="h-9 text-xs"
                        value={reviewForm.numero}
                        onChange={(e) => setReviewForm((p) => ({ ...p, numero: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="pl-1 text-xs font-medium text-slate-600">Fecha</div>
                      <Input
                        type="date"
                        className="h-9 text-xs"
                        value={reviewForm.fecha}
                        onChange={(e) => setReviewForm((p) => ({ ...p, fecha: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="pl-1 text-xs font-medium text-slate-600">Tipo</div>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                        value={reviewForm.tipo}
                        onChange={(e) => setReviewForm((p) => ({ ...p, tipo: e.target.value }))}
                      >
                        <option value="Ingresos">Ingresos</option>
                        <option value="Gastos">Gastos</option>
                        <option value="Por Revisar">Por Revisar</option>
                        <option value="No Factura">No Factura</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-2" />

                  <div className="space-y-2">
                    <div className="text-[13px] font-semibold text-slate-800">Datos Comprador</div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
                      <div>
                        <div className="pl-1 text-xs font-medium text-slate-600">CIF/NIF</div>
                        <Input
                          className="h-8 text-xs"
                          value={reviewForm.buyerTaxId}
                          onChange={(e) => setReviewForm((p) => ({ ...p, buyerTaxId: e.target.value }))}
                        />
                      </div>
                      <div>
                        <div className="pl-1 text-xs font-medium text-slate-600">Nombre comprador</div>
                        <Input
                          className="h-8 text-xs"
                          value={reviewForm.buyerName}
                          onChange={(e) => setReviewForm((p) => ({ ...p, buyerName: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2" />

                  <div className="space-y-2">
                    <div className="text-[13px] font-semibold text-slate-800">Datos Vendedor</div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
                      <div>
                        <div className="pl-1 text-xs font-medium text-slate-600">CIF/NIF</div>
                        <Input
                          className="h-8 text-xs"
                          value={reviewForm.sellerTaxId}
                          onChange={(e) => setReviewForm((p) => ({ ...p, sellerTaxId: e.target.value }))}
                        />
                      </div>
                      <div>
                        <div className="pl-1 text-xs font-medium text-slate-600">Nombre vendedor</div>
                        <Input
                          className="h-8 text-xs"
                          value={reviewForm.sellerName}
                          onChange={(e) => setReviewForm((p) => ({ ...p, sellerName: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2" />

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <div className="pl-1 text-xs font-medium text-slate-600">IVA</div>
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            className="h-9 text-xs pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={reviewForm.iva}
                            onChange={(e) => setReviewForm((p) => ({ ...p, iva: e.target.value }))}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md border-l border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                            EUR
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="pl-1 text-xs font-medium text-slate-600">Descuentos</div>
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            className="h-9 text-xs pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={reviewForm.descuentos}
                            onChange={(e) => setReviewForm((p) => ({ ...p, descuentos: e.target.value }))}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md border-l border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                            EUR
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="pl-1 text-xs font-medium text-slate-600">Retenciones</div>
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            className="h-9 text-xs pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={reviewForm.retenciones}
                            onChange={(e) => setReviewForm((p) => ({ ...p, retenciones: e.target.value }))}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md border-l border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                            EUR
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <div className="pl-1 text-xs font-medium text-slate-600">Importe sin IVA</div>
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            className="h-9 text-xs pr-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={reviewForm.importeSinIva}
                            onChange={(e) => setReviewForm((p) => ({ ...p, importeSinIva: e.target.value }))}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md border-l border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                            EUR
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="pl-1 text-xs font-medium text-slate-600">Importe Total</div>
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            className={`h-9 text-xs pr-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              showAmountsMismatchHint && amountsCheck.status === 'mismatch'
                                ? 'ring-2 ring-red-300 ring-offset-2 ring-offset-white'
                                : ''
                            }`}
                            value={reviewForm.importeTotal}
                            onChange={(e) => setReviewForm((p) => ({ ...p, importeTotal: e.target.value }))}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md border-l border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                            EUR
                          </div>
                        </div>
                        {showAmountsMismatchHint && amountsCheck.status === 'mismatch' && amountsCheck.expected != null ? (
                          <div className="mt-1 pl-1 text-[11px] font-semibold text-red-700">
                            Check importes incorrecto. Suma = {amountsCheck.expected.toFixed(2)}€
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-600">No hay facturas pendientes.</div>
          )}
        </div>
      )}

      {hasActiveFilters && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={resetFilters} className="h-8 px-2 lg:px-3 text-xs">
              Reset filters
              <X className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
