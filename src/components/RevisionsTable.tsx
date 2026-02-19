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
  desc_ret_extra?: number | string | null;
  importe_total: number | string | null;
  factura_uid: string | null;
  invoice_reason: string | null;
  factura_revisada?: boolean | null;
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
    return 'hace unos segundos';
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return `hace ${diffMin} min`;
  }
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) {
    return `hace ${diffHour} h`;
  }
  const diffDay = Math.round(diffHour / 24);
  if (diffDay === 1) {
    return 'ayer';
  }
  if (diffDay < 7) {
    return `hace ${diffDay} días`;
  }
  return target.toLocaleDateString();
};

type RevisionRow = {
  id: number;
  rawDate: string;
  tipo: string;
  numero: string;
  buyerName: string;
  clienteProveedor: string;
  sellerName: string;
  concepto: string;
  importeSinIva: number | string | null;
  iva: number | string | null;
  descRetExtra: number | string | null;
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
    return row.buyerName || row.clienteProveedor || '—';
  }

  if (row.tipo === 'Gastos') {
    return row.sellerName || row.clienteProveedor || '—';
  }

  if (row.tipo === 'Por Revisar') {
    return 'Por Revisar';
  }

  if (row.tipo === 'No Factura') {
    return 'No Factura';
  }

  return row.buyerName || row.sellerName || row.clienteProveedor || '—';
};

const getTipoBadgeClasses = (tipo: string) => {
  if (tipo === 'Por Revisar') {
    return 'bg-amber-100 text-amber-950 border-amber-300';
  }

  if (tipo === 'No Factura') {
    return 'bg-violet-100 text-violet-950 border-violet-300';
  }

  if (tipo === 'Ingresos') {
    return 'bg-emerald-50 text-emerald-900 border-emerald-200';
  }

  if (tipo === 'Gastos') {
    return 'bg-rose-50 text-rose-900 border-rose-200';
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
  const [historySort, setHistorySort] = React.useState<'desc' | 'asc'>('desc');

  const [dateSort, setDateSort] = React.useState<null | 'asc' | 'desc'>(null);

  const [reviewForm, setReviewForm] = React.useState({
    numero: '',
    fecha: '',
    tipo: 'Por Revisar',
    buyerName: '',
    buyerTaxId: '',
    sellerName: '',
    sellerTaxId: '',
    iva: '',
    descRetExtra: '',
    importeSinIva: '',
    importeTotal: '',
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [nfUnlock, setNfUnlock] = React.useState(false);
  const [nfConfirmStep, setNfConfirmStep] = React.useState<0 | 1>(0);
  const [validateConfirmStep, setValidateConfirmStep] = React.useState<0 | 1>(0);
  const validateConfirmTimeoutRef = React.useRef<number | null>(null);

  const businessName = user?.businessName?.trim() || '';
  const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;

  const scope = scopeProp ?? scopeState;

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
    const isNoFactura = selected.tipo === 'No Factura';
    setNfUnlock(!isNoFactura);

    setReviewForm({
      numero: selected.numero ?? '',
      fecha: selected.rawDate ?? '',
      tipo: selected.tipo ?? 'Por Revisar',
      buyerName: selected.buyerName ?? '',
      buyerTaxId: selected.clienteProveedor ?? '',
      sellerName: selected.sellerName ?? '',
      sellerTaxId: selected.clienteProveedor ?? '',
      iva: selected.iva == null ? '' : String(selected.iva),
      descRetExtra: selected.descRetExtra == null ? '' : String(selected.descRetExtra),
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
          'id, numero, fecha, tipo, buyer_name, buyer_tax_id, seller_name, seller_tax_id, invoice_concept, importe_sin_iva, iva, desc_ret_extra, importe_total, factura_uid, invoice_reason, factura_revisada, reviewed_at, drive_file_id, drive_type'
        )
        .eq('factura_revisada', scope === 'pending' ? false : true);

      if (scope === 'pending') {
        query = query.order('fecha', { ascending: false });
      } else {
        query = query.order('reviewed_at', { ascending: historySort === 'asc', nullsFirst: false }).order('fecha', { ascending: false });
      }

      if (empresaId != null && businessName) {
        query = query.or(`empresa_id.eq.${empresaId},user_businessname.eq.${businessName}`);
      } else {
        query = empresaId != null ? query.eq('empresa_id', empresaId) : query.eq('user_businessname', businessName);
      }

      if (tipoFilter !== 'all') {
        query = query.eq('tipo', tipoFilter);
      }

      const makeCountQuery = (reviewed: boolean) => {
        let countQuery = supabase
          .from('facturas')
          .select('id', { count: 'exact', head: true })
          .eq('factura_revisada', reviewed);

        if (empresaId != null) {
          countQuery = countQuery.eq('empresa_id', empresaId);
        } else if (businessName) {
          // Fallback (shouldn't happen in your system, but keeps behavior safe)
          countQuery = countQuery.eq('user_businessname', businessName);
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

      const mapped: RevisionRow[] = typedRows.map((row) => {
        const resolvedDriveType =
          row.drive_type === 'onedrive' || row.drive_type === 'googledrive' ? (row.drive_type as DriveType) : null;

        return {
          id: row.id,
          rawDate: row.fecha,
          tipo: row.tipo,
          numero: row.numero,
          buyerName: row.buyer_name ?? '',
          clienteProveedor: row.buyer_tax_id ?? row.seller_tax_id ?? '',
          sellerName: row.seller_name ?? '',
          concepto: row.invoice_concept ?? '',
          importeSinIva: row.importe_sin_iva ?? null,
          iva: row.iva ?? null,
          descRetExtra: row.desc_ret_extra ?? null,
          importeTotal: row.importe_total ?? null,
          reviewed: Boolean(row.factura_revisada),
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
    refreshKey,
    scope,
    historySort,
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

  const handleValidateAndNext = async () => {
    if (!selected) {
      return;
    }

    if (validateConfirmStep === 0) {
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
      const descRetExtra = parseOptionalNumber(reviewForm.descRetExtra);
      if (descRetExtra === undefined) {
        toast({
          title: 'Formato incorrecto',
          description: '“Descuentos/Retenciones” debe ser un número.',
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

      const payload = {
        numero,
        fecha,
        tipo,
        buyer_name: buyerName || null,
        buyer_tax_id: buyerTaxId || null,
        seller_name: sellerName || null,
        seller_tax_id: sellerTaxId || null,
        importe_sin_iva: importeSinIva,
        iva,
        desc_ret_extra: descRetExtra,
        importe_total: importeTotal,
        factura_revisada: true,
        reviewed_at: reviewedAt,
      };

      const { data: updatedRows, error } = await supabase.from('facturas').update(payload).eq('id', selected.id).select('id');
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
        description: 'La factura se ha guardado correctamente.',
      });

      // Next selection before mutating local list
      const idx = data.findIndex((r) => r.id === selected.id);
      const next = idx >= 0 ? data[idx + 1] ?? data[idx - 1] ?? null : data[0] ?? null;

      setData((prev) => {
        if (scope === 'pending') {
          return prev.filter((r) => r.id !== selected.id);
        }
        return prev.map((r) => (r.id === selected.id ? { ...r, reviewedAt, reviewed: true } : r));
      });
      if (scope === 'pending') {
        if (next) {
          onSelect?.(next.id, next);
          setMode('review');
        } else {
          setMode('list');
        }
      } else {
        // In history, stay on the same invoice after saving.
      }
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setValidateConfirmStep(0);
      if (validateConfirmTimeoutRef.current) {
        window.clearTimeout(validateConfirmTimeoutRef.current);
        validateConfirmTimeoutRef.current = null;
      }
    }
  };

  const handleNoFacturaConfirm = async () => {
    if (!selected) {
      return;
    }

    if (nfConfirmStep === 0) {
      setNfConfirmStep(1);
      return;
    }

    setIsSaving(true);
    try {
      const reviewedAt = new Date().toISOString();
      const { data: updatedRows, error } = await supabase
        .from('facturas')
        .update({ tipo: 'No Factura', factura_revisada: true, reviewed_at: reviewedAt })
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

      setDetailsRefreshKey((prev) => prev + 1);
      if (scope === 'pending') {
        if (next) {
          onSelect?.(next.id, next);
          setMode('review');
        } else {
          setMode('list');
        }
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
                {tipo === 'Por Revisar' ? 'Por revisar' : tipo === 'No Factura' ? 'No factura' : tipo}
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
        header: 'Contraparte',
        cell: ({ row }) => <span className="font-medium text-slate-900 truncate block">{resolveContraparte(row.original)}</span>,
        size: 9999,
      },
      {
        id: 'importe',
        header: () => <div className="text-right font-semibold">Importe (EUR)</div>,
        cell: ({ row }) => {
          const raw = row.original.importeTotal;
          const value = raw == null || raw === '' ? null : Number(String(raw).replace(',', '.'));
          return (
            <div className="text-right tabular-nums">
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
        header: () => <div className="text-right font-semibold">Revisada</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{row.original.reviewedAt ? formatRelativeTime(row.original.reviewedAt) : '—'}</div>
        ),
        size: 140,
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
      {mode === 'list' ? (
        <div className="flex flex-col gap-2 mb-3">
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-[150px]">
                <Select value={tipoFilter} onValueChange={(value) => setTipoFilter(value as typeof tipoFilter)}>
                  <SelectTrigger className="h-7 px-2 text-xs">
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Ingresos">Ingresos</SelectItem>
                    <SelectItem value="Gastos">Gastos</SelectItem>
                    <SelectItem value="Por Revisar">Por revisar</SelectItem>
                    <SelectItem value="No Factura">No factura</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scope === 'history' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setHistorySort((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                >
                  {historySort === 'desc' ? 'Últimas primero' : 'Antiguas primero'}
                </Button>
              ) : null}
            </div>
            <div className="w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar..."
                  className="w-full rounded-lg bg-background pl-7 md:w-[180px] h-7 text-xs"
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
          padding: 0.5rem 0.5rem;
          text-align: left;
        }

        .revisions-table th:nth-child(1),
        .revisions-table td:nth-child(1) {
          width: 120px;
          min-width: 120px;
          padding-left: 0.25rem;
          padding-right: 0.25rem;
        }

        .revisions-table th:nth-child(2),
        .revisions-table td:nth-child(2) {
          width: 105px;
          min-width: 105px;
          padding-left: 0.25rem;
          padding-right: 0.25rem;
        }

        .revisions-table th:nth-child(4),
        .revisions-table td:nth-child(4) {
          width: 120px;
          min-width: 120px;
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
        <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-slate-200 bg-white p-3">
          {selected ? (
            <div className="mt-3 relative">
              {selected.tipo === 'No Factura' && !nfUnlock ? (
                <div className="absolute inset-0 z-10 flex items-start justify-center">
                  <div className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-xs font-semibold text-amber-900">
                      ¿Es una factura/recibo/transacción que debas contabilizar?
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="h-7 bg-slate-900 hover:bg-slate-900 text-xs"
                        onClick={() => {
                          setNfUnlock(true);
                          setNfConfirmStep(0);
                          setReviewForm((prev) => ({ ...prev, tipo: 'Por Revisar' }));
                        }}
                      >
                        Sí, es factura
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={isSaving}
                        onClick={() => void handleNoFacturaConfirm()}
                      >
                        {nfConfirmStep === 0 ? 'No, no es factura' : 'Confirmar: no es factura'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={selected.tipo === 'No Factura' && !nfUnlock ? 'pointer-events-none blur-sm select-none' : ''}>
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <div className="pl-1 text-xs font-medium text-slate-600">Número</div>
                      <Input
                        className="h-8 text-xs"
                        value={reviewForm.numero}
                        onChange={(e) => setReviewForm((p) => ({ ...p, numero: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="pl-1 text-xs font-medium text-slate-600">Fecha</div>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={reviewForm.fecha}
                        onChange={(e) => setReviewForm((p) => ({ ...p, fecha: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="pl-1 text-xs font-medium text-slate-600">Tipo</div>
                      <select
                        className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs"
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

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <div className="pl-1 text-xs font-medium text-slate-600">IVA</div>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={reviewForm.iva}
                        onChange={(e) => setReviewForm((p) => ({ ...p, iva: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="pl-1 text-xs font-medium text-slate-600">Descuentos/Retenciones</div>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={reviewForm.descRetExtra}
                        onChange={(e) => setReviewForm((p) => ({ ...p, descRetExtra: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <div className="pl-1 text-xs font-medium text-slate-600">Importe sin IVA</div>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={reviewForm.importeSinIva}
                        onChange={(e) => setReviewForm((p) => ({ ...p, importeSinIva: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="pl-1 text-xs font-medium text-slate-600">Importe Total</div>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={reviewForm.importeTotal}
                        onChange={(e) => setReviewForm((p) => ({ ...p, importeTotal: e.target.value }))}
                      />
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
