'use client';
import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { ChevronLeft, ChevronRight, RefreshCw, Search, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { usePathname } from 'next/navigation';

const TOGGLE_TRASH_WEBHOOK_URL = 'https://v-ascendsolutions.app.n8n.cloud/webhook/toggle-trash';

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
  deleted_at?: string | null;
  is_trashed?: boolean | null;
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
  deletedAt: string | null;
  isTrashed: boolean;
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

  if (row.tipo === 'Por Revisar' || row.tipo === 'Desconocido') {
    return 'Desconocido';
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
  if (tipo === 'Por Revisar' || tipo === 'Desconocido') {
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
  onPapeleraCountChange?: (count: number) => void;
  selectedId?: number | null;
  onSelect?: (id: number, row: RevisionRow) => void;
  onDataLoaded?: (rows: RevisionRow[]) => void;
  refreshKey?: number;
  scope?: 'pending' | 'history' | 'trash';
}

export default function RevisionsTable({
  onPorRevisarCountChange,
  onNoFacturasCountChange,
  onHistoricoCountChange,
  onPapeleraCountChange,
  selectedId = null,
  onSelect,
  onDataLoaded,
  refreshKey = 0,
  scope: scopeProp,
}: RevisionsTableProps) {
  const { toast } = useToast();
  const { user, isLoading } = useDashboardSession();
  const pathname = usePathname();
  const [data, setData] = React.useState<RevisionRow[]>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [tipoFilter, setTipoFilter] = React.useState<'all' | 'Ingresos' | 'Gastos' | 'Desconocido' | 'No Factura'>('all');
  const [mode, setMode] = React.useState<'list' | 'review'>('list');
  const [scopeState, setScopeState] = React.useState<'pending' | 'history' | 'trash'>('pending');

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
    tipo: 'Desconocido',
    buyerName: '',
    buyerTaxId: '',
    sellerName: '',
    sellerTaxId: '',
    iva: '',
    importeSinIva: '',
    importeTotal: '',
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRowsLoading, setIsRowsLoading] = React.useState(true);
  const [hasLoadedRowsOnce, setHasLoadedRowsOnce] = React.useState(false);
  const [nfUnlock, setNfUnlock] = React.useState(false);
  const [validateConfirmStep, setValidateConfirmStep] = React.useState<0 | 1>(0);
  const [showInvalidTipoWarning, setShowInvalidTipoWarning] = React.useState(false);
  const validateConfirmTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPendingRowsCountRef = React.useRef<number | null>(null);
  const [showPendingConfetti, setShowPendingConfetti] = React.useState(false);
  const suppressedPendingIdsRef = React.useRef<Map<number, number>>(new Map());
  const unlockedNoFacturaIdsRef = React.useRef<Set<number>>(new Set());
  const tableScrollRef = React.useRef<HTMLDivElement | null>(null);
  const rowElementRefs = React.useRef<Map<number, HTMLTableRowElement>>(new Map());
  const lastAutoScrolledInvoiceIdRef = React.useRef<number | null>(null);
  const autoScrollRafRef = React.useRef<number | null>(null);
  const closeAnimationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closingInvoiceId, setClosingInvoiceId] = React.useState<number | null>(null);
  const [isTrashConfirmOpen, setIsTrashConfirmOpen] = React.useState(false);
  const [trashConfirmAction, setTrashConfirmAction] = React.useState<null | { invoiceId: number; action: 'restore' | 'delete' }>(
    null
  );
  const hydratedReviewInvoiceIdRef = React.useRef<number | null>(null);

  const businessName = user?.businessName?.trim() || '';
  const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;

  const scope = scopeProp ?? scopeState;
  const isTrashScope = scope === 'trash';

  const scrollInvoiceRowToTop = React.useCallback((invoiceId: number, durationMs = 420) => {
    const container = tableScrollRef.current;
    const rowEl = rowElementRefs.current.get(invoiceId);
    if (!container || !rowEl) {
      return;
    }

    const targetTop = Math.max(0, rowEl.offsetTop - 2);
    const startTop = container.scrollTop;
    const distance = targetTop - startTop;

    if (Math.abs(distance) < 1) {
      container.scrollTop = targetTop;
      return;
    }

    if (autoScrollRafRef.current != null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }

    const startAt = performance.now();

    const step = (now: number) => {
      const elapsed = now - startAt;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - progress) * (1 - progress) * (1 - progress);
      container.scrollTop = startTop + distance * eased;
      if (progress < 1) {
        autoScrollRafRef.current = requestAnimationFrame(step);
      } else {
        autoScrollRafRef.current = null;
      }
    };

    autoScrollRafRef.current = requestAnimationFrame(step);
  }, []);

  React.useEffect(() => {
    if (mode !== 'review' || selectedId == null) {
      return;
    }

    if (lastAutoScrolledInvoiceIdRef.current === selectedId) {
      return;
    }

    lastAutoScrolledInvoiceIdRef.current = selectedId;
    scrollInvoiceRowToTop(selectedId, 460);
  }, [mode, selectedId, scrollInvoiceRowToTop]);

  React.useEffect(() => {
    if (mode !== 'review') {
      lastAutoScrolledInvoiceIdRef.current = null;
    }
  }, [mode]);

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
    if (mode !== 'review') {
      hydratedReviewInvoiceIdRef.current = null;
      return;
    }

    if (!selected) {
      return;
    }

    if (hydratedReviewInvoiceIdRef.current === selected.id) {
      return;
    }

    hydratedReviewInvoiceIdRef.current = selected.id;
    const isNoFactura = selected.tipo === 'No Factura';
    const isAlreadyUnlocked = isNoFactura && unlockedNoFacturaIdsRef.current.has(selected.id);
    setNfUnlock(!isNoFactura || isAlreadyUnlocked);

    setReviewForm({
      numero: selected.numero ?? '',
      fecha: selected.rawDate ?? '',
      tipo: selected.tipo ?? 'Desconocido',
      buyerName: selected.buyerName ?? '',
      buyerTaxId: selected.buyerTaxId ?? '',
      sellerName: selected.sellerName ?? '',
      sellerTaxId: selected.sellerTaxId ?? '',
      iva: selected.iva == null ? '' : String(selected.iva),
      importeSinIva: selected.importeSinIva == null ? '' : String(selected.importeSinIva),
      importeTotal: selected.importeTotal == null ? '' : String(selected.importeTotal),
    });
  }, [mode, selected]);

  React.useEffect(() => {
    if (pathname && !pathname.startsWith('/dashboard/revisiones')) {
      unlockedNoFacturaIdsRef.current.clear();
      setNfUnlock(false);
    }
  }, [pathname]);

  React.useEffect(() => {
    return () => {
      if (closeAnimationTimeoutRef.current) {
        clearTimeout(closeAnimationTimeoutRef.current);
        closeAnimationTimeoutRef.current = null;
      }
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = null;
      }
      if (autoScrollRafRef.current != null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!hasLoadedRowsOnce) {
      setIsRowsLoading(true);
    }

    if (!businessName && empresaId == null) {
      setData([]);
      onPorRevisarCountChange?.(0);
      onNoFacturasCountChange?.(0);
      setHasLoadedRowsOnce(true);
      setIsRowsLoading(false);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      let query = supabase
        .from('facturas')
        .select(
          'id, numero, fecha, tipo, buyer_name, buyer_tax_id, seller_name, seller_tax_id, invoice_concept, importe_sin_iva, iva, descuentos, retenciones, importe_total, factura_uid, invoice_reason, factura_validada, reviewed_at, deleted_at, is_trashed, drive_file_id, drive_type'
        );

      if (scope === 'trash') {
        query = query.eq('is_trashed', true);
      } else {
        query = query.not('is_trashed', 'is', true);
      }

      if (scope !== 'trash') {
        query = query.eq('factura_validada', scope === 'pending' ? false : true);
      }

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
          .eq('factura_validada', reviewed)
          .not('is_trashed', 'is', true);

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

      let trashCountQuery = supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('is_trashed', true);

      if (empresaId != null) {
        trashCountQuery = trashCountQuery.eq('empresa_id', empresaId);
      } else if (businessName) {
        trashCountQuery = trashCountQuery.eq('user_businessname', businessName);
      }

      if (tipoFilter !== 'all') {
        trashCountQuery = trashCountQuery.eq('tipo', tipoFilter);
      }

      if (periodRange) {
        trashCountQuery = trashCountQuery.gte('fecha', periodRange.start).lte('fecha', periodRange.end);
      }

      const [{ data: rows, error }, pendingCountRes, historyCountRes, trashCountRes] = await Promise.all([
        query,
        makeCountQuery(false),
        makeCountQuery(true),
        trashCountQuery,
      ]);

      if (!isMounted) {
        return;
      }

      if (error || !rows) {
        setData([]);
        onPorRevisarCountChange?.(pendingCountRes.count ?? 0);
        onNoFacturasCountChange?.(0);
        onHistoricoCountChange?.(historyCountRes.count ?? 0);
        onPapeleraCountChange?.(trashCountRes.count ?? 0);
        setHasLoadedRowsOnce(true);
        setIsRowsLoading(false);
        return;
      }

      const typedRows = rows as FacturaRow[];

      const noFacturasCount = scope === 'pending' ? typedRows.filter((r) => r.tipo === 'No Factura').length : 0;

      onPorRevisarCountChange?.(pendingCountRes.count ?? 0);
      onNoFacturasCountChange?.(noFacturasCount);
      onHistoricoCountChange?.(historyCountRes.count ?? 0);
      onPapeleraCountChange?.(trashCountRes.count ?? 0);

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
          deletedAt: row.deleted_at ?? null,
          isTrashed: Boolean(row.is_trashed),
          driveFileId: row.drive_file_id ?? null,
          driveType: resolvedDriveType,
        };
      });

      let finalRows = mapped;
      if (scope === 'pending') {
        const now = Date.now();
        const fetchedIds = new Set(mapped.map((row) => row.id));

        suppressedPendingIdsRef.current.forEach((expiresAt, id) => {
          if (expiresAt <= now || !fetchedIds.has(id)) {
            suppressedPendingIdsRef.current.delete(id);
          }
        });

        if (suppressedPendingIdsRef.current.size > 0) {
          finalRows = mapped.filter((row) => !suppressedPendingIdsRef.current.has(row.id));
        }
      }

      setData(finalRows);
      onDataLoaded?.(finalRows);
      setHasLoadedRowsOnce(true);
      setIsRowsLoading(false);
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [
    isLoading,
    hasLoadedRowsOnce,
    businessName,
    empresaId,
    tipoFilter,
    period,
    customRange.startDate,
    customRange.endDate,
    periodRange,
    refreshKey,
    scope,
    onDataLoaded,
    onPorRevisarCountChange,
    onNoFacturasCountChange,
    onHistoricoCountChange,
    onPapeleraCountChange,
  ]);

  const refreshPendingCount = React.useCallback(async () => {
    let pendingCountQuery = supabase
      .from('facturas')
      .select('id', { count: 'exact', head: true })
      .eq('factura_validada', false)
      .not('is_trashed', 'is', true);

    if (empresaId != null) {
      pendingCountQuery = pendingCountQuery.eq('empresa_id', empresaId);
    } else if (businessName) {
      pendingCountQuery = pendingCountQuery.eq('user_businessname', businessName);
    }

    if (tipoFilter !== 'all') {
      pendingCountQuery = pendingCountQuery.eq('tipo', tipoFilter);
    }

    if (periodRange) {
      pendingCountQuery = pendingCountQuery.gte('fecha', periodRange.start).lte('fecha', periodRange.end);
    }

    const pendingCountRes = await pendingCountQuery;
    const pendingCount = pendingCountRes.count ?? 0;
    onPorRevisarCountChange?.(pendingCount);
    window.dispatchEvent(new CustomEvent('revisions-count-updated', { detail: { pending: pendingCount } }));
  }, [businessName, empresaId, onPorRevisarCountChange, periodRange, tipoFilter]);

  const toggleTrashState = React.useCallback(
    async (invoiceId: number, action: 'restore' | 'delete') => {
      toast({
        title: action === 'restore' ? 'Restaurando factura' : 'Eliminando factura',
        description: 'Estamos procesando la solicitud.',
      });

      let removedRow: RevisionRow | null = null;
      setData((prev) => {
        removedRow = prev.find((row) => row.id === invoiceId) ?? null;
        return prev.filter((row) => row.id !== invoiceId);
      });

      if (selectedId === invoiceId) {
        setMode('list');
      }

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
          body: JSON.stringify({ factura_id: invoiceId }),
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

        const wasRestored = payload?.action === 'restored' || action === 'restore';
        toast({
          title: wasRestored ? 'Factura restaurada' : 'Factura eliminada',
          description: wasRestored
            ? 'La factura se ha restaurado correctamente.'
            : 'La factura se ha enviado correctamente a la papelera.',
          className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
        });

        void refreshPendingCount();
      } catch (error) {
        if (removedRow) {
          setData((prev) => (prev.some((row) => row.id === removedRow!.id) ? prev : [removedRow!, ...prev]));
        }

        throw error;
      }
    },
    [refreshPendingCount, selectedId, toast]
  );

  const handleRestoreInvoice = React.useCallback(
    (invoiceId: number) => {
      setTrashConfirmAction({ invoiceId, action: 'restore' });
      setIsTrashConfirmOpen(true);
    },
    []
  );

  const handleDeleteInvoice = React.useCallback(
    (invoiceId: number) => {
      setTrashConfirmAction({ invoiceId, action: 'delete' });
      setIsTrashConfirmOpen(true);
    },
    []
  );

  const handleConfirmTrashAction = React.useCallback(async () => {
    if (!trashConfirmAction) {
      return;
    }

    const { invoiceId, action } = trashConfirmAction;
    setIsTrashConfirmOpen(false);

    try {
      await toggleTrashState(invoiceId, action);
    } catch (error) {
      toast({
        title: action === 'restore' ? 'No se pudo restaurar la factura' : 'No se pudo eliminar la factura',
        description: error instanceof Error ? error.message : 'No se pudo completar la acción.',
        variant: 'destructive',
      });
    } finally {
      setTrashConfirmAction(null);
    }
  }, [toggleTrashState, toast, trashConfirmAction]);

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

  const handleValidateAndNext = async () => {
    if (!selected) {
      return;
    }

    const tipoToValidate = String(reviewForm.tipo ?? '').trim();
    const isAllowedTipo = tipoToValidate === 'No Factura' || tipoToValidate === 'Ingresos' || tipoToValidate === 'Gastos';
    if (!isAllowedTipo) {
      setShowInvalidTipoWarning(true);
      setValidateConfirmStep(0);
      if (validateConfirmTimeoutRef.current) {
        clearTimeout(validateConfirmTimeoutRef.current);
        validateConfirmTimeoutRef.current = null;
      }
      return;
    }

    if (validateConfirmStep === 0) {
      setValidateConfirmStep(1);
      if (validateConfirmTimeoutRef.current) {
        clearTimeout(validateConfirmTimeoutRef.current);
      }
      validateConfirmTimeoutRef.current = setTimeout(() => {
        setValidateConfirmStep(0);
        validateConfirmTimeoutRef.current = null;
      }, 3500);
      return;
    }

    if (selected.tipo === 'No Factura' && !nfUnlock) {
      return;
    }

    const previousRows = data;
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
      const importeTotal = parseOptionalNumber(reviewForm.importeTotal);
      if (importeTotal === undefined) {
        toast({
          title: 'Formato incorrecto',
          description: '“Importe total” debe ser un número.',
          variant: 'destructive',
        });
        return;
      }

      const reviewedAt = new Date().toISOString();
      const optimisticRow: RevisionRow = {
        ...selected,
        numero,
        rawDate: fecha,
        tipo,
        buyerName,
        buyerTaxId,
        sellerName,
        sellerTaxId,
        importeSinIva,
        iva,
        descuentos: selected.descuentos,
        retenciones: selected.retenciones,
        importeTotal,
        reviewed: true,
        reviewedAt,
      };

      if (scope === 'pending') {
        suppressedPendingIdsRef.current.set(selected.id, Date.now() + 12000);
        advanceToNext(selected.id);
      } else {
        setData((prev) => prev.map((row) => (row.id === selected.id ? optimisticRow : row)));
      }

      const webhookPayload = {
        user_uid: user?.id ?? null,
        empresa_id: empresaId,
        factura_id: selected.id,
        invoice_uid: selected.invoice_uid,
        reviewed_at: reviewedAt,
        factura_validada: true,
        factura: {
          id: selected.id,
          invoice_uid: selected.invoice_uid,
          numero,
          fecha,
          tipo,
          buyer_name: buyerName || null,
          buyer_tax_id: buyerTaxId || null,
          seller_name: sellerName || null,
          seller_tax_id: sellerTaxId || null,
          invoice_concept: selected.concepto || null,
          importe_sin_iva: importeSinIva,
          iva,
          descuentos: selected.descuentos ?? null,
          retenciones: selected.retenciones ?? null,
          importe_total: importeTotal,
          reviewed_at: reviewedAt,
          factura_validada: true,
          deleted_at: selected.deletedAt,
          is_trashed: selected.isTrashed,
          drive_file_id: selected.driveFileId,
          drive_type: selected.driveType,
        },
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

      void refreshPendingCount();

      toast({
        title: 'Enviado',
        description: 'La validación se ha guardado correctamente.',
      });
    } catch (error) {
      if (scope === 'pending') {
        suppressedPendingIdsRef.current.delete(selected.id);
      }
      setData(previousRows);
      onSelect?.(selected.id, selected);
      setMode('review');

      console.error('Error validando factura (supabase)', error);
      toast({
        title: 'No se pudo validar la factura',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo. Si el problema persiste, contacta con soporte en hola@clerio.es',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setValidateConfirmStep(0);
      if (validateConfirmTimeoutRef.current) {
        clearTimeout(validateConfirmTimeoutRef.current);
        validateConfirmTimeoutRef.current = null;
      }
    }
  };

  const handleSwapCounterpartyData = () => {
    setReviewForm((prev) => ({
      ...prev,
      buyerTaxId: prev.sellerTaxId,
      buyerName: prev.sellerName,
      sellerTaxId: prev.buyerTaxId,
      sellerName: prev.buyerName,
    }));
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

      setData((prev) => {
        if (scope === 'pending') {
          return prev.filter((r) => r.id !== selected.id);
        }
        return prev.map((r) => (r.id === selected.id ? { ...r, reviewedAt, reviewed: true } : r));
      });
      setNfUnlock(true);
      setMode('list');
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
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
                {tipo === 'No Factura' ? 'No factura' : tipo === 'Por Revisar' ? 'Desconocido' : tipo}
              </span>
            </div>
          );
        },
        size: 98,
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
        size: isTrashScope ? 94 : 120,
      },
    ];

    if (!isTrashScope) {
      base.unshift({
        id: 'estado',
        header: () => <div className="text-center font-semibold">Estado</div>,
        cell: ({ row }) => {
          const isReviewed = Boolean(row.original.reviewed);
          return (
            <div className="flex justify-center">
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  isReviewed ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-900'
                }`}
              >
                {isReviewed ? 'Validada' : 'Pendiente'}
              </span>
            </div>
          );
        },
        size: 92,
      });
    }

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

    if (isTrashScope) {
      base.push(
        {
          id: 'deletedAt',
          header: () => <div className="text-center font-semibold">Eliminada</div>,
          cell: ({ row }) => (
            <div className="text-center tabular-nums">{row.original.deletedAt ? formatRelativeTime(row.original.deletedAt) : '—'}</div>
          ),
          size: 96,
        },
        {
          id: 'restore',
          header: () => <div className="text-center font-semibold">Restaurar</div>,
          cell: ({ row }) => (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="h-7 w-7 border-slate-200 p-0 text-xs"
                aria-label="Restaurar factura"
                title="Restaurar factura"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleRestoreInvoice(row.original.id);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          ),
          size: 112,
        },
      );
    }

    return base;
  }, [scope, dateSort, handleRestoreInvoice, isTrashScope]);

  const sortedData = React.useMemo(() => {
    const tipoRank: Record<string, number> = {
      'No Factura': 0,
      Desconocido: 1,
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

  const moveSelection = React.useCallback(
    (currentId: number, direction: 'prev' | 'next', keepReviewMode: boolean) => {
      const idx = sortedData.findIndex((r) => r.id === currentId);
      if (idx < 0) {
        return;
      }

      const next = direction === 'next' ? sortedData[idx + 1] ?? null : sortedData[idx - 1] ?? null;
      if (!next) {
        return;
      }

      if (closeAnimationTimeoutRef.current) {
        clearTimeout(closeAnimationTimeoutRef.current);
        closeAnimationTimeoutRef.current = null;
      }

      setClosingInvoiceId(null);
      setValidateConfirmStep(0);
      onSelect?.(next.id, next);
      setMode(keepReviewMode ? 'review' : 'list');
      lastAutoScrolledInvoiceIdRef.current = keepReviewMode ? next.id : null;
      requestAnimationFrame(() => {
        scrollInvoiceRowToTop(next.id, 420);
      });
    },
    [onSelect, scrollInvoiceRowToTop, sortedData]
  );

  const advanceToNext = React.useCallback(
    (currentId: number) => {
      const idx = sortedData.findIndex((r) => r.id === currentId);
      const next = idx >= 0 ? sortedData[idx + 1] ?? sortedData[idx - 1] ?? null : sortedData[0] ?? null;

      if (scope === 'pending') {
        suppressedPendingIdsRef.current.set(currentId, Date.now() + 12000);
      }

      setData((prev) => {
        if (scope === 'pending') {
          return prev.filter((row) => row.id !== currentId);
        }
        return prev;
      });

      if (closeAnimationTimeoutRef.current) {
        clearTimeout(closeAnimationTimeoutRef.current);
        closeAnimationTimeoutRef.current = null;
      }

      setClosingInvoiceId(null);

      if (!next) {
        setMode('list');
        lastAutoScrolledInvoiceIdRef.current = null;
        return;
      }

      onSelect?.(next.id, next);
      setMode('review');
      lastAutoScrolledInvoiceIdRef.current = next.id;
      requestAnimationFrame(() => {
        scrollInvoiceRowToTop(next.id, 420);
      });
    },
    [onSelect, scope, scrollInvoiceRowToTop, sortedData]
  );

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

  const selectedSortedIndex = React.useMemo(
    () => (selectedId == null ? -1 : sortedData.findIndex((row) => row.id === selectedId)),
    [selectedId, sortedData]
  );
  const hasPreviousInvoice = selectedSortedIndex > 0;
  const hasNextInvoice = selectedSortedIndex >= 0 && selectedSortedIndex < sortedData.length - 1;
  const rowsCount = table.getRowModel().rows.length;
  const showLoadingRowsState = mode === 'list' && isRowsLoading && rowsCount === 0;
  const showPendingCelebration = mode === 'list' && scope === 'pending' && rowsCount === 0 && !hasActiveFilters && !globalFilter.trim();
  const showHistoryEmptyState = mode === 'list' && scope === 'history' && rowsCount === 0 && !hasActiveFilters && !globalFilter.trim();
  const showTrashEmptyState = mode === 'list' && scope === 'trash' && rowsCount === 0 && !hasActiveFilters && !globalFilter.trim();

  React.useEffect(() => {
    const canCelebrate = scope === 'pending' && !hasActiveFilters && !globalFilter.trim();

    if (!canCelebrate) {
      prevPendingRowsCountRef.current = rowsCount;
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = null;
      }
      setShowPendingConfetti(false);
      return;
    }

    const previousRows = prevPendingRowsCountRef.current;
    if (rowsCount === 0 && previousRows != null && previousRows > 0) {
      setShowPendingConfetti(true);
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
      confettiTimeoutRef.current = setTimeout(() => {
        setShowPendingConfetti(false);
        confettiTimeoutRef.current = null;
      }, 5000);
    }

    if (rowsCount > 0) {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = null;
      }
      setShowPendingConfetti(false);
    }

    prevPendingRowsCountRef.current = rowsCount;
  }, [globalFilter, hasActiveFilters, rowsCount, scope]);

  return (
    <div
      className={`relative h-full flex flex-col overflow-hidden p-4 rounded-lg border text-sm ${
        scope === 'history' ? 'bg-slate-50 border-slate-300' : scope === 'trash' ? 'bg-red-50/30 border-red-200' : 'bg-white border-gray-200'
      }`}
    >
      {showInvalidTipoWarning ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/20 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="text-sm font-semibold text-slate-900">Pendiente de revisión -&gt; Tipo de factura</div>
            <div className="mt-2 text-sm text-slate-700">
              No se puede validar una factura de tipo &quot;Desconocido&quot;. Por favor, comprueba y corrige los datos de la factura.
            </div>
            <div className="mt-4 flex items-center justify-end">
              <Button type="button" className="h-8 bg-slate-900 hover:bg-slate-800 text-xs" onClick={() => setShowInvalidTipoWarning(false)}>
                Entendido
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'list' ? (
        <div className="mb-3 flex min-h-[52px] flex-col justify-center gap-2">
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Tipo</div>
                <div className="w-[96px]">
                  <Select value={tipoFilter} onValueChange={(value) => setTipoFilter(value as typeof tipoFilter)}>
                    <SelectTrigger className="h-7 px-2 text-[11px] w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="Ingresos">Ingresos</SelectItem>
                      <SelectItem value="Gastos">Gastos</SelectItem>
                      <SelectItem value="Desconocido">Desconocido</SelectItem>
                      <SelectItem value="No Factura">No factura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Período</div>
                <div className="w-[120px]">
                  <Select value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
                    <SelectTrigger className="h-7 px-2 text-[11px] w-full">
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
                    className="h-8 px-2 text-xs"
                    value={customRange.startDate}
                    onChange={(e) => setCustomRange((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                  <span className="text-xs text-slate-400">—</span>
                  <Input
                    type="date"
                    className="h-8 px-2 text-xs"
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
                  className="w-full rounded-lg bg-background pl-7 md:w-[150px] h-7 text-[11px]"
                  value={globalFilter ?? ''}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-3 min-h-[52px] grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex justify-start">
            <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setMode('list')}>
              Volver a la lista
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={!selected || isSaving || !hasPreviousInvoice}
              onClick={() => {
                if (selectedId == null) {
                  return;
                }
                moveSelection(selectedId, 'prev', mode === 'review');
              }}
              aria-label="Factura anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={!selected || isSaving || !hasNextInvoice}
              onClick={() => {
                if (selectedId == null) {
                  return;
                }
                moveSelection(selectedId, 'next', mode === 'review');
              }}
              aria-label="Factura siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-end">
            {scope !== 'trash' ? (
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
            ) : null}
          </div>
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
          padding: 0.78rem 0.75rem;
          text-align: center;
        }

        .revisions-table thead th {
          position: sticky;
          top: 0;
          z-index: 20;
          background: ${scope === 'history' ? '#f8fafc' : scope === 'trash' ? '#fef2f2' : '#ffffff'};
          box-shadow: inset 0 -1px 0 rgba(226, 232, 240, 1);
        }

        .revisions-table th:nth-child(1),
        .revisions-table td:nth-child(1) {
          width: 88px;
          min-width: 88px;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
        }

        .revisions-table th:nth-child(2),
        .revisions-table td:nth-child(2) {
          width: 90px;
          min-width: 90px;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
        }

        .revisions-table th:nth-child(3),
        .revisions-table td:nth-child(3) {
          width: ${scope === 'trash' ? '58%' : '94px'};
          min-width: ${scope === 'trash' ? '300px' : '94px'};
        }

        .revisions-table th:nth-child(4),
        .revisions-table td:nth-child(4) {
          width: ${scope === 'trash' ? '96px' : scope === 'history' ? '61%' : '68%'};
          min-width: ${scope === 'trash' ? '96px' : scope === 'history' ? '320px' : '300px'};
        }

        .revisions-table th:nth-child(5),
        .revisions-table td:nth-child(5) {
          width: ${scope === 'trash' ? '92px' : '120px'};
          min-width: ${scope === 'trash' ? '92px' : '120px'};
        }

        .revisions-table th:nth-child(6),
        .revisions-table td:nth-child(6) {
          width: ${scope === 'trash' ? '76px' : '110px'};
          min-width: ${scope === 'trash' ? '76px' : '110px'};
        }

        .revisions-confetti-piece {
          position: absolute;
          top: -16px;
          width: 8px;
          height: 14px;
          border-radius: 999px;
          opacity: 0.9;
          animation: revisionsConfettiFall 1800ms linear infinite;
        }

        .revisions-confetti-burst {
          animation: revisionsConfettiBurstFade 5000ms ease-out forwards;
        }

        @keyframes revisionsConfettiFall {
          0% {
            transform: translateY(-14px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(210px) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes revisionsConfettiBurstFade {
          0% {
            opacity: 1;
          }
          75% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        .revisions-expanded-panel {
          animation: revisionsExpandIn 420ms cubic-bezier(0.16, 1, 0.3, 1);
          transform-origin: top center;
          will-change: opacity, transform;
        }

        .revisions-expanded-panel.closing {
          animation: revisionsExpandOut 320ms cubic-bezier(0.4, 0, 1, 1) forwards;
        }

        @keyframes revisionsExpandIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes revisionsExpandOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-6px);
          }
        }
      `}</style>

      <div className="relative flex-1 min-h-0 rounded-md border overflow-hidden">
        <div ref={tableScrollRef} className="h-full overflow-y-auto">
          <Table className="revisions-table text-xs">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="truncate">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                const isSelected = row.original.id === selectedId;
                const shouldExpand = mode === 'review' && isSelected && !!selected;
                const isClosing = closingInvoiceId === row.original.id;
                const shouldRenderExpanded = shouldExpand || isClosing;

                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      ref={(node) => {
                        if (node) {
                          rowElementRefs.current.set(row.original.id, node);
                        } else {
                          rowElementRefs.current.delete(row.original.id);
                        }
                      }}
                      className={`${isSelected ? getSelectedRowClasses(true) : getRowClasses(row.original.tipo)} cursor-pointer transition-colors duration-200`}
                      onClick={() => {
                        if (isSelected && mode === 'review') {
                          if (closeAnimationTimeoutRef.current) {
                            clearTimeout(closeAnimationTimeoutRef.current);
                            closeAnimationTimeoutRef.current = null;
                          }
                          lastAutoScrolledInvoiceIdRef.current = row.original.id;
                          scrollInvoiceRowToTop(row.original.id, 300);
                          setClosingInvoiceId(row.original.id);
                          setMode('list');
                          setValidateConfirmStep(0);
                          closeAnimationTimeoutRef.current = setTimeout(() => {
                            setClosingInvoiceId((prev) => (prev === row.original.id ? null : prev));
                            closeAnimationTimeoutRef.current = null;
                          }, 320);
                          return;
                        }

                        if (closeAnimationTimeoutRef.current) {
                          clearTimeout(closeAnimationTimeoutRef.current);
                          closeAnimationTimeoutRef.current = null;
                        }
                        setClosingInvoiceId(null);
                        onSelect?.(row.original.id, row.original);
                        setValidateConfirmStep(0);
                        setMode('review');
                        lastAutoScrolledInvoiceIdRef.current = null;
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="truncate">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>

                    {shouldRenderExpanded ? (
                      <TableRow className="bg-slate-50/70">
                        <TableCell colSpan={table.getVisibleFlatColumns().length} className="!p-0">
                          <div className={`revisions-expanded-panel relative m-2 overflow-hidden rounded-lg border border-slate-300 bg-white p-3 shadow-[0_18px_42px_rgba(15,23,42,0.16)] text-left ${isClosing ? 'closing' : ''}`}>
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-slate-300/80 to-transparent" />
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />
                            {scope !== 'trash' && selected?.tipo === 'No Factura' && !nfUnlock ? (
                              <div className="absolute inset-0 z-10 bg-slate-950/24 backdrop-blur-sm">
                                <div className="flex h-full items-start justify-center px-3">
                                  <div className="mt-8 w-full max-w-md rounded-lg bg-white px-3 py-2 text-center shadow-lg">
                                    <div className="text-xs font-semibold text-slate-900">¿Es un documento que debas contabilizar?</div>
                                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                                      <Button
                                        type="button"
                                        className="h-7 bg-slate-900 hover:bg-slate-900 text-xs"
                                        onClick={() => {
                                          if (selected) {
                                            unlockedNoFacturaIdsRef.current.add(selected.id);
                                          }
                                          setNfUnlock(true);
                                          setReviewForm((prev) => ({ ...prev, tipo: 'Desconocido' }));
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

                            <div className={scope !== 'trash' && selected?.tipo === 'No Factura' && !nfUnlock ? 'pointer-events-none blur-[1px] select-none' : scope === 'trash' ? 'pointer-events-none select-none' : ''}>
                              <div className="grid grid-cols-1 gap-3">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                  <div>
                                    <div className="text-left pl-1 text-xs font-medium text-slate-600">Número</div>
                                    <Input
                                      className="h-9 text-xs"
                                      value={reviewForm.numero}
                                      readOnly={isTrashScope}
                                      onChange={(e) => setReviewForm((p) => ({ ...p, numero: e.target.value }))}
                                    />
                                  </div>
                                  <div>
                                    <div className="text-left pl-1 text-xs font-medium text-slate-600">Fecha</div>
                                    <Input
                                      type="date"
                                      className="h-9 text-xs"
                                      value={reviewForm.fecha}
                                      readOnly={isTrashScope}
                                      onChange={(e) => setReviewForm((p) => ({ ...p, fecha: e.target.value }))}
                                    />
                                  </div>
                                  <div>
                                    <div className="text-left pl-1 text-xs font-medium text-slate-600">Tipo</div>
                                    <select
                                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                                      value={reviewForm.tipo}
                                      disabled={isTrashScope}
                                      onChange={(e) => {
                                        setReviewForm((p) => ({ ...p, tipo: e.target.value }));
                                      }}
                                    >
                                      <option value="Ingresos">Ingresos</option>
                                      <option value="Gastos">Gastos</option>
                                      <option value="Desconocido">Desconocido</option>
                                      <option value="No Factura">No Factura</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div className="relative">
                                    <div className="space-y-3">
                                      <div className="text-left text-[13px] font-semibold text-slate-800">Datos Comprador</div>
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
                                        <div>
                                          <div className="text-left pl-1 text-xs font-medium text-slate-600">CIF/NIF</div>
                                          <Input
                                            className="h-9 text-xs"
                                            value={reviewForm.buyerTaxId}
                                            onChange={(e) => setReviewForm((p) => ({ ...p, buyerTaxId: e.target.value }))}
                                          />
                                        </div>
                                        <div className="sm:max-w-[75%]">
                                          <div className="text-left pl-1 text-xs font-medium text-slate-600">Nombre comprador</div>
                                          <Input
                                            className="h-9 text-xs"
                                            value={reviewForm.buyerName}
                                            onChange={(e) => setReviewForm((p) => ({ ...p, buyerName: e.target.value }))}
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-5" />

                                    <div className="space-y-3">
                                      <div className="text-left text-[13px] font-semibold text-slate-800">Datos Vendedor</div>
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_1fr]">
                                        <div>
                                          <div className="text-left pl-1 text-xs font-medium text-slate-600">CIF/NIF</div>
                                          <Input
                                            className="h-9 text-xs"
                                            value={reviewForm.sellerTaxId}
                                            onChange={(e) => setReviewForm((p) => ({ ...p, sellerTaxId: e.target.value }))}
                                          />
                                        </div>
                                        <div className="sm:max-w-[75%]">
                                          <div className="text-left pl-1 text-xs font-medium text-slate-600">Nombre vendedor</div>
                                          <Input
                                            className="h-9 text-xs"
                                            value={reviewForm.sellerName}
                                            onChange={(e) => setReviewForm((p) => ({ ...p, sellerName: e.target.value }))}
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-3 flex items-center gap-2 sm:absolute sm:right-0 sm:top-[58%] sm:mt-0 sm:-translate-y-1/2">
                                      <span className="text-xs font-medium text-slate-600">Intercambiar</span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 w-9 p-0"
                                        disabled={isTrashScope}
                                        onClick={handleSwapCounterpartyData}
                                        aria-label="Intercambiar datos comprador y vendedor"
                                      >
                                        <RefreshCw className="h-[17px] w-[17px] text-slate-800" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-5" />

                                <div className="space-y-3">
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div>
                                      <div className="text-left pl-1 text-xs font-medium text-slate-600">IVA</div>
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
                                      <div className="text-left pl-1 text-xs font-medium text-slate-600">Importe sin IVA</div>
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
                                      <div className="text-left pl-1 text-xs font-medium text-slate-600">Importe Total</div>
                                      <div className="relative">
                                        <Input
                                          inputMode="decimal"
                                          className="h-9 text-xs pr-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={reviewForm.importeTotal}
                                          onChange={(e) => setReviewForm((p) => ({ ...p, importeTotal: e.target.value }))}
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md border-l border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                                          EUR
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {scope === 'trash' && selected ? (
                              <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 border-slate-300 text-xs"
                                  onClick={() => void handleRestoreInvoice(selected.id)}
                                >
                                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                  Restaurar
                                </Button>
                              </div>
                            ) : null}

                            {scope !== 'trash' && selected ? (
                              <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
                                <Button
                                  type="button"
                                  className="h-8 bg-red-500 text-xs hover:bg-red-600"
                                  onClick={() => void handleDeleteInvoice(selected.id)}
                                >
                                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                  Eliminar factura
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {showLoadingRowsState ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="text-center text-sm font-medium text-slate-500/80">Cargando facturas…</div>
          </div>
        ) : null}

        {showPendingCelebration && !showLoadingRowsState ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-amber-200 bg-white/95 px-6 py-8 text-center shadow-[0_22px_48px_rgba(15,23,42,0.18)] backdrop-blur-[1px]">
              <div className="text-4xl leading-none">🥳</div>
              <div className="mt-3 text-lg font-semibold tracking-[-0.01em] text-slate-900">
                ¡Enhorabuena! No tienes ninguna factura pendiente de validar
              </div>
              <div className="mt-2 text-sm text-slate-600">Todo está al día. Buen trabajo.</div>
              {showPendingConfetti ? (
                <div className="revisions-confetti-burst pointer-events-none absolute inset-x-4 top-0 h-52 overflow-hidden" aria-hidden>
                  {Array.from({ length: 14 }).map((_, index) => (
                    <span
                      key={`confetti-${index}`}
                      className="revisions-confetti-piece"
                      style={{
                        left: `${6 + index * 6.4}%`,
                        animationDelay: `${index * 120}ms`,
                        backgroundColor: ['#f59e0b', '#22c55e', '#0ea5e9', '#fb7185'][index % 4],
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {showHistoryEmptyState && !showLoadingRowsState ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="text-center text-[19px] font-medium tracking-[-0.01em] text-slate-500/70">
              Todavía no tienes ninguna factura validada
            </div>
          </div>
        ) : null}

        {showTrashEmptyState && !showLoadingRowsState ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="text-center text-[19px] font-medium tracking-[-0.01em] text-slate-500/70">
              No tienes facturas en la papelera
            </div>
          </div>
        ) : null}
      </div>

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

      <Dialog
        open={isTrashConfirmOpen}
        onOpenChange={(open) => {
          setIsTrashConfirmOpen(open);
          if (!open) {
            setTrashConfirmAction(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border border-slate-200 bg-white p-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {trashConfirmAction?.action === 'restore'
                ? 'Restaurar factura'
                : trashConfirmAction?.action === 'delete'
                  ? 'Eliminar factura'
                  : ''}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              {trashConfirmAction?.action === 'restore'
                ? '¿Seguro que quieres restaurar esta factura?'
                : trashConfirmAction?.action === 'delete'
                  ? '¿Seguro que quieres eliminar esta factura?'
                  : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex-row justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setIsTrashConfirmOpen(false);
                setTrashConfirmAction(null);
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={
                trashConfirmAction?.action === 'restore'
                  ? 'rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900'
                  : 'rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600'
              }
              onClick={() => void handleConfirmTrashAction()}
            >
              {trashConfirmAction?.action === 'restore' ? 'Restaurar' : 'Eliminar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
