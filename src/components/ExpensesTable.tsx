'use client';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';

import { Search, Eye, Download, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { InvoiceDetailDrawer, type InvoiceDetailDrawerRow } from '@/components/InvoiceDetailDrawer';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';
import { TableFilters, type TableFiltersValue } from '@/components/ui/table-filters';
import { DateRangeSelector, getDefaultCurrentQuarterRange, type DateRangeValue } from '@/components/ui/date-range-selector';

const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
type DriveType = 'googledrive' | 'onedrive';
const PAGE_SIZE = 20;

type PendingTooltipState = {
  open: boolean;
  x: number;
  y: number;
};

const DEFAULT_DATE_RANGE = getDefaultCurrentQuarterRange();

const normalizeFacturaValidada = (value: unknown): boolean | null => {
  if (value === true || value === false) {
    return value;
  }
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 't' || normalized === '1') return true;
    if (normalized === 'false' || normalized === 'f' || normalized === '0') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
};

function ExpensesActionsCell({
  invoiceId,
  driveFileId,
  driveType,
  needsReview,
}: {
  invoiceId: number;
  driveFileId: string | null;
  driveType: DriveType;
  needsReview: boolean;
}) {
  const dotRef = React.useRef<HTMLDivElement | null>(null);
  const [pendingTooltip, setPendingTooltip] = React.useState<PendingTooltipState>({
    open: false,
    x: 0,
    y: 0,
  });

  const openPendingTooltip = () => {
    if (!dotRef.current) {
      return;
    }

    const rect = dotRef.current.getBoundingClientRect();
    setPendingTooltip({
      open: true,
      x: rect.right,
      y: rect.bottom + 8,
    });
  };

  const closePendingTooltip = () => {
    setPendingTooltip((prev) => ({ ...prev, open: false }));
  };

  const previewHref =
    driveFileId && driveType
      ? `/api/files/open?drive_type=${encodeURIComponent(driveType)}&drive_file_id=${encodeURIComponent(
          driveFileId
        )}&kind=preview`
      : undefined;

  const downloadHref =
    driveFileId && driveType
      ? `/api/files/open?drive_type=${encodeURIComponent(driveType)}&drive_file_id=${encodeURIComponent(
          driveFileId
        )}&kind=download`
      : undefined;

  const handleDownload = () => {
    if (!driveFileId || !driveType) {
      return;
    }

    if (!downloadHref) {
      return;
    }

    window.open(downloadHref, '_blank', 'noopener,noreferrer');
  };

  const canOpen = Boolean(driveFileId && driveType);
  const reviewHref = `/dashboard/revisiones?invoiceId=${invoiceId}&scope=pending`;

  return (
    <div className="flex items-center space-x-3 pr-2">
      <a
        href={previewHref ?? '#'}
        target={previewHref ? '_blank' : undefined}
        rel={previewHref ? 'noopener,noreferrer' : undefined}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${canOpen ? '' : 'text-gray-400 pointer-events-none'}`}
        aria-label={canOpen ? 'Ver factura' : 'Vista previa no disponible'}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Eye className="h-4 w-4" />
      </a>
      <Button
        variant="ghost"
        size="icon"
        className={canOpen ? '' : 'text-gray-400'}
        disabled={!canOpen}
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
        }}
        aria-label={canOpen ? 'Descargar factura' : 'Archivo no disponible'}
      >
        <Download className="h-4 w-4" />
      </Button>

      <div
        className="relative z-10 w-4 flex justify-center"
        ref={needsReview ? dotRef : null}
        onMouseEnter={needsReview ? openPendingTooltip : undefined}
        onMouseLeave={needsReview ? closePendingTooltip : undefined}
        onFocus={needsReview ? openPendingTooltip : undefined}
        onBlur={needsReview ? closePendingTooltip : undefined}
        tabIndex={needsReview ? 0 : -1}
        aria-hidden={!needsReview}
      >
        {needsReview ? (
          <a
            href={reviewHref}
            onClick={(e) => {
              e.stopPropagation();
            }}
            aria-label="Ir a validar factura"
            className="relative block h-3 w-3 cursor-pointer transition-transform duration-200 hover:scale-110"
          >
            <div className="absolute -inset-1 rounded-full bg-amber-600/12 blur-[6px] animate-pulse" />
            <div className="absolute -inset-0.5 rounded-full bg-amber-500/16 blur-[4px] animate-pulse" />
            <div className="absolute inset-[3px] rounded-full bg-amber-500 shadow-[0_0_0_1px_rgba(255,255,255,0.45)]" />
          </a>
        ) : (
          <div className="h-3 w-3 opacity-0" />
        )}
        {needsReview && pendingTooltip.open && typeof document !== 'undefined'
          ? ReactDOM.createPortal(
              <div
                className="pointer-events-none fixed z-[999999] w-max max-w-[220px] rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow"
                style={{ left: pendingTooltip.x - 8, top: pendingTooltip.y, transform: 'translateX(-100%)' }}
              >
                Factura pendiente de validar
              </div>,
              document.body
            )
          : null}
      </div>
    </div>
  );
}

const SortIndicator = ({ state }: { state: false | 'asc' | 'desc' }) => (
  <span
    aria-hidden
    className={`text-xs transition-colors ${state ? 'text-gray-600' : 'text-gray-300'}`}
  >
    {state === 'asc' ? '↑' : state === 'desc' ? '↓' : '↕'}
  </span>
);

const formatDate = (value: string) => {
  if (!value) {
    return '';
  }
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
};

const normalizeClientLabel = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-/])([a-záéíóúüñ])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);

interface ExpensesTableProps {
  onTotalExpensesChange?: (total: number) => void;
  onInvoiceCountChange?: (count: number) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  refreshKey?: number;
  processedInvoiceCount?: number;
  processedInvoiceCountReady?: boolean;
}

type FacturaRow = {
  id: number;
  numero: string;
  fecha: string;
  seller_name: string | null;
  seller_tax_id: string | null;
  invoice_concept: string | null;
  importe_sin_iva: number | string | null;
  importe_total: number | string | null;
  drive_file_id: string | null;
  drive_type?: string | null;
  factura_validada?: boolean | null;
};

export type Expense = {
  id: number;
  date: string;
  rawDate: string;
  invoice: string;
  provider: string;
  description: string;
  subtotal: string;
  total: string;
  subtotalValue: number;
  totalValue: number;
  driveFileId: string | null;
  driveType: DriveType;
  facturaValidada: boolean | null;
  sellerName?: string | null;
  sellerTaxId?: string | null;
  invoiceConcept?: string | null;
  importeSinIvaRaw?: number | string | null;
  importeTotalRaw?: number | string | null;
  ivaRaw?: number | null;
};

type ExpensesRowsCacheEntry = {
  rows: Expense[];
  hasMoreRows: boolean;
  nextOffset: number;
};

const expensesRowsCache = new Map<string, ExpensesRowsCacheEntry>();

const areExpenseRowsEqual = (a: Expense[], b: Expense[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left.id !== right.id ||
      left.rawDate !== right.rawDate ||
      left.totalValue !== right.totalValue ||
      left.subtotalValue !== right.subtotalValue ||
      left.facturaValidada !== right.facturaValidada
    ) {
      return false;
    }
  }

  return true;
};

export const columns: ColumnDef<Expense>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <div className="w-12 flex justify-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="w-12 flex justify-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      </div>
    ),
    size: 48, // 3rem (12 * 4px)
    enableSorting: false,
    enableHiding: false,
  },
  { 
    accessorKey: 'date', 
    header: ({ column }) => {
      const sortState = column.getIsSorted();
      return (
        <button
          type="button"
          className="flex items-center gap-1 font-semibold"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Fecha
          <SortIndicator state={sortState} />
        </button>
      );
    },
    size: 40,
    minSize: 40,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.rawDate ?? rowA.getValue<string>('date');
      const b = rowB.original.rawDate ?? rowB.getValue<string>('date');
      return (a ?? '').localeCompare(b ?? '');
    },
  },
  { 
    accessorKey: 'invoice', 
    header: 'Nº Factura',
    cell: ({ getValue }) => {
      const value = getValue<string>() ?? '';
      const displayValue = value.trim() ? value : '-';
      return (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="group inline-flex min-w-0 items-center gap-1.5 cursor-zoom-in pr-2">
                <span className="block truncate min-w-0 flex-1">{displayValue}</span>
                <Search className="h-3.5 w-3.5 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs break-words text-sm">
              {displayValue}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    size: 120,
    minSize: 120,
  },
  { 
    accessorKey: 'provider', 
    header: 'Proveedor',
    cell: ({ getValue }) => {
      const value = getValue<string>() ?? '';
      const displayValue = value.trim() ? value : '-';
      return (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block truncate cursor-zoom-in pr-2">{displayValue}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs break-words text-sm">
              {displayValue}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    size: 150,
    minSize: 120,
  },
  {
    accessorKey: 'description',
    header: 'Descripción',
    cell: ({ getValue }) => {
      const value = getValue<string>() ?? '';
      const displayValue = value.trim() ? value : '-';
      return (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block truncate cursor-zoom-in pr-2">{displayValue}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs break-words text-sm">
              {displayValue}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    size: 200,
    minSize: 150,
  },
  {
    accessorKey: 'subtotal',
    header: ({ column }) => {
      const sortState = column.getIsSorted();
      return (
        <button
          type="button"
          className="flex w-full justify-center items-center gap-1 font-semibold"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Subtotal
          <SortIndicator state={sortState} />
        </button>
      );
    },
    cell: ({ getValue }) => {
      const value = getValue<string>();
      const formatted = value?.startsWith('-') ? value : `-${value}`;
      return (
        <span className="block text-center font-semibold text-red-600">
          {formatted}
        </span>
      );
    },
    size: 100,
    minSize: 90,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.subtotalValue ?? 0;
      const b = rowB.original.subtotalValue ?? 0;
      return a - b;
    },
  },
  {
    accessorKey: 'total',
    header: ({ column }) => {
      const sortState = column.getIsSorted();
      return (
        <button
          type="button"
          className="flex w-full justify-center items-center gap-1 font-semibold"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Total
          <SortIndicator state={sortState} />
        </button>
      );
    },
    cell: ({ getValue }) => {
      const value = getValue<string>();
      const formatted = value?.startsWith('-') ? value : `-${value}`;
      return (
        <span className="block text-center font-semibold text-red-600">
          {formatted}
        </span>
      );
    },
    size: 100,
    minSize: 90,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.totalValue ?? 0;
      const b = rowB.original.totalValue ?? 0;
      return a - b;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <ExpensesActionsCell
        invoiceId={row.original.id}
        driveFileId={row.original.driveFileId}
        driveType={row.original.driveType}
        needsReview={row.original.facturaValidada !== true}
      />
    ),
    size: 108,
    minSize: 108,
  },
];

export function ExpensesTable({
  onTotalExpensesChange,
  onInvoiceCountChange,
  onDateRangeChange,
  refreshKey = 0,
  processedInvoiceCount = 0,
  processedInvoiceCountReady = true,
}: ExpensesTableProps) {
  const { user, isLoading } = useDashboardSession();
  const [sourceData, setSourceData] = React.useState<Expense[]>([]);
  const [isDataHydrated, setIsDataHydrated] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(false);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const [hasMoreRows, setHasMoreRows] = React.useState(true);
  const [drawerRow, setDrawerRow] = React.useState<InvoiceDetailDrawerRow | null>(null);
  const tableScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [filters, setFilters] = React.useState<TableFiltersValue>({
    startDate: DEFAULT_DATE_RANGE.startDate,
    endDate: DEFAULT_DATE_RANGE.endDate,
    minAmount: null,
    maxAmount: null,
    clients: [],
  });

  React.useEffect(() => {
    onDateRangeChange?.({ startDate: filters.startDate, endDate: filters.endDate });
  }, [filters.endDate, filters.startDate, onDateRangeChange]);

  const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;
  const queryCacheKey = React.useMemo(() => {
    if (empresaId == null) {
      return null;
    }

    const normalizedClients = [...filters.clients]
      .map((client) => normalizeClientLabel(client))
      .sort((a, b) => a.localeCompare(b, 'es'));

    return JSON.stringify({
      empresaId,
      startDate: filters.startDate || '',
      endDate: filters.endDate || '',
      minAmount: filters.minAmount,
      maxAmount: filters.maxAmount,
      clients: normalizedClients,
    });
  }, [empresaId, filters.clients, filters.endDate, filters.maxAmount, filters.minAmount, filters.startDate]);
  const nextOffsetRef = React.useRef(0);
  const hasMoreRowsRef = React.useRef(true);
  const isFetchingMoreRef = React.useRef(false);

  React.useEffect(() => {
    hasMoreRowsRef.current = hasMoreRows;
  }, [hasMoreRows]);

  React.useEffect(() => {
    isFetchingMoreRef.current = isFetchingMore;
  }, [isFetchingMore]);

  const fetchRowsPage = React.useCallback(
    async (reset: boolean) => {
      if (isLoading || empresaId == null) {
        if (!isLoading && empresaId == null) {
          setSourceData([]);
          setHasMoreRows(false);
          setIsDataHydrated(true);
        }
        return;
      }

      if (reset) {
        setIsInitialLoading(true);
        setIsFetchingMore(false);
        isFetchingMoreRef.current = false;
      } else {
        if (isFetchingMoreRef.current || !hasMoreRowsRef.current) {
          return;
        }
        setIsFetchingMore(true);
        isFetchingMoreRef.current = true;
      }

      const from = reset ? 0 : nextOffsetRef.current;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('facturas')
        .select(
          'id, numero, fecha, seller_name, seller_tax_id, invoice_concept, importe_sin_iva, importe_total, drive_file_id, drive_type, factura_validada'
        )
        .eq('empresa_id', empresaId)
        .eq('tipo', 'Gastos')
        .eq('is_trashed', false)
        .order('fecha', { ascending: false })
        .range(from, to);

      if (filters.startDate && filters.endDate) {
        query = query.gte('fecha', filters.startDate).lte('fecha', filters.endDate);
      }

      if (filters.minAmount != null && filters.maxAmount != null) {
        query = query.gte('importe_total', filters.minAmount).lte('importe_total', filters.maxAmount);
      }

      if (filters.clients.length > 0) {
        query = query.in('seller_name', filters.clients);
      }

      const { data: rows, error } = await query;

      if (error || !rows) {
        if (reset) {
          setSourceData([]);
          setHasMoreRows(false);
          hasMoreRowsRef.current = false;
        }
        setIsDataHydrated(true);
        setIsInitialLoading(false);
        setIsFetchingMore(false);
        isFetchingMoreRef.current = false;
        return;
      }

      const mapped = (rows as FacturaRow[]).map((row: FacturaRow) => {
        const subtotalValue = Math.abs(Number(row.importe_sin_iva) || 0);
        const totalValue = Math.abs(Number(row.importe_total) || 0);
        const ivaValue =
          Number.isFinite(subtotalValue) && Number.isFinite(totalValue)
            ? Number(totalValue) - Number(subtotalValue)
            : null;

        return {
          id: row.id,
          date: formatDate(row.fecha),
          rawDate: row.fecha,
          invoice: row.numero,
          provider: row.seller_name ?? '',
          description: row.invoice_concept ?? '',
          subtotal: `-${currencyFormatter.format(subtotalValue)}`,
          total: `-${currencyFormatter.format(totalValue)}`,
          subtotalValue,
          totalValue,
          driveFileId: row.drive_file_id ?? null,
          driveType: (row.drive_type === 'onedrive' || row.drive_type === 'googledrive'
            ? row.drive_type
            : 'googledrive') as DriveType,
          facturaValidada: normalizeFacturaValidada(row.factura_validada),
          sellerName: row.seller_name,
          sellerTaxId: row.seller_tax_id,
          invoiceConcept: row.invoice_concept,
          importeSinIvaRaw: row.importe_sin_iva,
          importeTotalRaw: row.importe_total,
          ivaRaw: ivaValue,
        };
      });

      const nextOffset = from + mapped.length;
      const nextHasMoreRows = mapped.length === PAGE_SIZE;

      nextOffsetRef.current = nextOffset;
      setHasMoreRows(nextHasMoreRows);
      hasMoreRowsRef.current = nextHasMoreRows;
      setSourceData((prev) => {
        const nextRows = reset ? mapped : [...prev, ...mapped];
        const resolvedRows = areExpenseRowsEqual(prev, nextRows) ? prev : nextRows;

        if (queryCacheKey) {
          expensesRowsCache.set(queryCacheKey, {
            rows: resolvedRows,
            hasMoreRows: nextHasMoreRows,
            nextOffset,
          });
        }

        return resolvedRows;
      });
      setIsDataHydrated(true);
      setIsInitialLoading(false);
      setIsFetchingMore(false);
      isFetchingMoreRef.current = false;
    },
    [empresaId, filters.clients, filters.endDate, filters.maxAmount, filters.minAmount, filters.startDate, isLoading, queryCacheKey]
  );

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    if (queryCacheKey) {
      const cached = expensesRowsCache.get(queryCacheKey);
      if (cached) {
        setSourceData((prev) => (areExpenseRowsEqual(prev, cached.rows) ? prev : cached.rows));
        setHasMoreRows(cached.hasMoreRows);
        hasMoreRowsRef.current = cached.hasMoreRows;
        nextOffsetRef.current = cached.nextOffset;
        setIsDataHydrated(true);
      } else {
        nextOffsetRef.current = 0;
        setHasMoreRows(true);
        hasMoreRowsRef.current = true;
      }
    } else {
      nextOffsetRef.current = 0;
      setHasMoreRows(true);
      hasMoreRowsRef.current = true;
    }

    void fetchRowsPage(true);
  }, [isLoading, queryCacheKey, refreshKey, fetchRowsPage]);

  React.useEffect(() => {
    const container = tableScrollRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 120;
      if (!isNearBottom || isInitialLoading || isFetchingMoreRef.current || !hasMoreRowsRef.current) {
        return;
      }
      void fetchRowsPage(false);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [fetchRowsPage, isInitialLoading]);

  const filteredData = React.useMemo(() => {
    let next = sourceData;

    if (filters.clients.length > 0) {
      const selectedClients = new Set(filters.clients.map((client) => normalizeClientLabel(client).toLowerCase()));
      next = next.filter((row) => selectedClients.has(normalizeClientLabel(row.provider).toLowerCase()));
    }

    if (filters.minAmount != null && filters.maxAmount != null) {
      next = next.filter(
        (row) => row.totalValue >= filters.minAmount! && row.totalValue <= filters.maxAmount!
      );
    }

    return next;
  }, [sourceData, filters.clients, filters.minAmount, filters.maxAmount]);

  React.useEffect(() => {
    if (!isDataHydrated) {
      return;
    }
    const total = filteredData.reduce((sum, row) => sum + (Number(row.totalValue) || 0), 0);
    onTotalExpensesChange?.(total);
    onInvoiceCountChange?.(filteredData.length);
  }, [filteredData, isDataHydrated, onTotalExpensesChange, onInvoiceCountChange]);

  const clients = React.useMemo(
    () =>
      Array.from(
        new Set(
          sourceData
            .map((row) => normalizeClientLabel(row.provider))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [sourceData]
  );

  const amountBounds = React.useMemo(() => {
    if (sourceData.length === 0) {
      return { min: 0, max: 0 };
    }
    const values = sourceData.map((row) => Math.max(0, row.totalValue));
    const highestValue = Math.max(...values);
    const roundedMax = Math.ceil(highestValue / 100) * 100;
    return { min: 0, max: roundedMax };
  }, [sourceData]);

  const resetFilters = () => {
    setFilters({
      startDate: DEFAULT_DATE_RANGE.startDate,
      endDate: DEFAULT_DATE_RANGE.endDate,
      clients: [],
      minAmount: null,
      maxAmount: null,
    });
    setGlobalFilter('');
  };

  const hasAmountFilter = filters.minAmount != null && filters.maxAmount != null;
  const hasActiveFilters = Boolean(filters.clients.length > 0 || hasAmountFilter);
  const hasGlobalFilter = globalFilter.trim().length > 0;
  const hasAnyUserFilter = hasActiveFilters || hasGlobalFilter;
  const emptyStateMessage = !hasAnyUserFilter && !processedInvoiceCountReady
    ? 'Cargando estado de facturas procesadas...'
    : !hasAnyUserFilter && processedInvoiceCount === 0
      ? 'No hay facturas de gastos procesadas.'
      : 'No hay facturas de gastos procesadas que cumplan los filtros aplicados.';

  React.useEffect(() => {
    if (!drawerRow?.id || !tableScrollRef.current) {
      return;
    }

    const rowId = String(drawerRow.id);
    const rows = tableScrollRef.current.querySelectorAll<HTMLTableRowElement>('tbody tr[data-invoice-row-id]');
    const target = Array.from(rows).find((r) => r.dataset.invoiceRowId === rowId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [drawerRow]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      rowSelection,
      globalFilter,
    },
    initialState: {
      sorting: [
        {
          id: 'date',
          desc: true,
        },
      ],
    },
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    defaultColumn: {
      minSize: 0,
      size: Number.MAX_SAFE_INTEGER,
      maxSize: Number.MAX_SAFE_INTEGER,
    },
  });

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 relative z-0">
      <div className="flex flex-col gap-2 mb-2">
        <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <TableFilters 
              filters={filters}
              onFiltersChange={setFilters}
              clients={clients}
              amountBounds={amountBounds}
              className="flex-1"
              hideDateSection
            />
            <Button variant="outline" size="sm" className="h-8 border-dashed" disabled>
              <Download className="h-4 w-4" />
            </Button>
            {hasActiveFilters && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {filters.clients.length > 0 && (
                  <div className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    Clientes: {filters.clients.length}
                    <button
                      type="button"
                      className="text-blue-200 hover:text-white text-xs leading-none"
                      onClick={() => setFilters((prev) => ({ ...prev, clients: [] }))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {hasAmountFilter && (
                  <div className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    Importe: {filters.minAmount}€ - {filters.maxAmount}€
                    <button
                      type="button"
                      className="text-blue-200 hover:text-white text-xs leading-none"
                      onClick={() => setFilters((prev) => ({ ...prev, minAmount: null, maxAmount: null }))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <Button
                  variant="ghost"
                  onClick={resetFilters}
                  className="h-7 px-2 text-[11px]"
                >
                  Reset filters
                  <X className="ml-1.5 h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="w-full sm:w-auto flex items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar..."
                className="w-full rounded-lg bg-background pl-8 md:w-[180px] h-8"
                value={globalFilter ?? ''}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(event.target.value)}
              />
            </div>
            <DateRangeSelector
              value={{ startDate: filters.startDate, endDate: filters.endDate }}
              onChange={(next) => {
                setFilters((prev) => ({ ...prev, startDate: next.startDate, endDate: next.endDate }));
              }}
              className="h-8 min-w-[210px]"
            />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .table {
          table-layout: fixed;
          width: 100%;
        }
        
        .table th, .table td {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 0.5rem 0.5rem;
          text-align: left;
        }
        .table th:first-child, .table td:first-child {
          padding-left: 0;
          padding-right: 0.5rem;
        }
        
        /* Column widths */
        .table th:nth-child(1), .table td:nth-child(1) { width: 18px; min-width: 18px; } /* Selector */
        .table th:nth-child(2), .table td:nth-child(2) { width: 40px; min-width: 40px; } /* Fecha */
        .table th:nth-child(3), .table td:nth-child(3) { width: 15%; } /* Nº Factura */
        .table th:nth-child(4), .table td:nth-child(4) { width: 15%; } /* Proveedor */
        .table th:nth-child(5), .table td:nth-child(5) { width: 25%; } /* Descripción */
        .table th:nth-child(6), .table td:nth-child(6) { width: 10%; min-width: 90px; } /* Subtotal */
        .table th:nth-child(7), .table td:nth-child(7) { width: 10%; min-width: 90px; } /* Total */
        .table th:nth-child(8), .table td:nth-child(8) { width: 10%; }  /* Acciones */
      `}</style>

      <div className="rounded-md border relative z-0">
        <div ref={tableScrollRef} className="max-h-[520px] overflow-y-auto">
          <Table className="table">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="truncate text-left">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-invoice-row-id={String(row.original.id)}
                  className={`cursor-pointer transition-colors ${
                    drawerRow?.id === row.original.id
                      ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-200 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.08)]'
                      : 'hover:bg-slate-50/70'
                  }`}
                  onClick={() => {
                    setDrawerRow({
                      id: row.original.id,
                      numero: row.original.invoice,
                      fecha: row.original.rawDate,
                      tipo: 'Gastos',
                      counterparty: row.original.provider,
                      buyer_name: null,
                      buyer_tax_id: null,
                      seller_name: row.original.sellerName ?? row.original.provider ?? null,
                      seller_tax_id: row.original.sellerTaxId ?? null,
                      invoice_concept: row.original.invoiceConcept ?? row.original.description ?? null,
                      importe_total: row.original.importeTotalRaw ?? row.original.totalValue,
                      importe_sin_iva: row.original.importeSinIvaRaw ?? row.original.subtotalValue,
                      iva: row.original.ivaRaw ?? null,
                      descuentos: null,
                      retenciones: null,
                      divisa: 'EUR',
                      drive_type: row.original.driveType,
                      drive_file_id: row.original.driveFileId,
                    });
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        cell.column.id === 'actions'
                          ? 'text-left overflow-visible pr-4'
                          : 'truncate text-left'
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {table.getRowModel().rows.length === 0 && isDataHydrated ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-[220px] p-0 align-middle">
                    <div className="flex h-full min-h-[220px] items-center justify-center px-6 text-center text-sm text-slate-500">
                      {emptyStateMessage}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {isFetchingMore && (
            <div className="py-3 text-center text-xs font-medium text-slate-500">Cargando facturas…</div>
          )}
        </div>
      </div>

      {drawerRow ? (
        <InvoiceDetailDrawer
          row={drawerRow}
          onClose={() => setDrawerRow(null)}
          onInvoiceTrashed={(invoiceId) => {
            setSourceData((prev) => prev.filter((item) => item.id !== invoiceId));
          }}
        />
      ) : null}

    </div>
  );
}
