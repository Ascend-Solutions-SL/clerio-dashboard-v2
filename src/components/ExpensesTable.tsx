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

const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
type DriveType = 'googledrive' | 'onedrive';
const expensesDataCache = new Map<string, Expense[]>();

type PendingTooltipState = {
  open: boolean;
  x: number;
  y: number;
};

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

const buildDriveDownloadUrl = (driveFileId?: string | null) =>
  driveFileId ? `https://drive.google.com/uc?export=download&id=${driveFileId}` : undefined;
const buildDrivePreviewUrl = (driveFileId?: string | null) =>
  driveFileId ? `https://drive.google.com/file/d/${driveFileId}/preview` : undefined;

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
  refreshKey?: number;
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

export function ExpensesTable({ onTotalExpensesChange, onInvoiceCountChange, refreshKey = 0 }: ExpensesTableProps) {
  const { user, isLoading } = useDashboardSession();
  const [sourceData, setSourceData] = React.useState<Expense[]>([]);
  const [isDataHydrated, setIsDataHydrated] = React.useState(false);
  const [drawerRow, setDrawerRow] = React.useState<InvoiceDetailDrawerRow | null>(null);
  const tableScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [filters, setFilters] = React.useState<TableFiltersValue>({
    startDate: '', 
    endDate: '',
    clients: [],
    minAmount: null,
    maxAmount: null,
  });

  const businessName = user?.businessName?.trim() || '';
  const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;
  const queryCacheKey = `${empresaId ?? 'none'}|${businessName}|${filters.startDate}|${filters.endDate}`;

  React.useEffect(() => {
    const cached = expensesDataCache.get(queryCacheKey);
    if (cached) {
      setSourceData(cached);
      setIsDataHydrated(true);
    }
  }, [queryCacheKey]);

  // Load table data (date filter at source)
  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!businessName && empresaId == null) {
      setSourceData([]);
      setIsDataHydrated(true);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      let query = supabase
        .from('facturas')
        .select(
          'id, numero, fecha, seller_name, seller_tax_id, invoice_concept, importe_sin_iva, importe_total, drive_file_id, drive_type, factura_validada'
        )
        .eq('tipo', 'Gastos')
        .eq('source', 'ocr')
        .order('fecha', { ascending: false });

      if (empresaId != null && businessName) {
        query = query.or(`empresa_id.eq.${empresaId},user_businessname.eq.${businessName}`);
      } else {
        query = empresaId != null ? query.eq('empresa_id', empresaId) : query.eq('user_businessname', businessName);
      }

      // Aplicar filtro de rango de fechas si existe
      if (filters.startDate && filters.endDate) {
        query = query
          .gte('fecha', filters.startDate)
          .lte('fecha', filters.endDate);
      }

      const { data: rows, error } = await query;

      if (!isMounted) {
        return;
      }

      if (error || !rows) {
        if (!expensesDataCache.has(queryCacheKey)) {
          setSourceData([]);
        }
        setIsDataHydrated(true);
        return;
      }

      const typedRows = rows as FacturaRow[];

      const mapped = typedRows.map((row: FacturaRow) => {
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

      const cached = expensesDataCache.get(queryCacheKey) ?? null;
      const didChange = JSON.stringify(cached) !== JSON.stringify(mapped);
      if (didChange) {
        expensesDataCache.set(queryCacheKey, mapped);
        setSourceData(mapped);
      } else if (cached) {
        setSourceData(cached);
      }
      setIsDataHydrated(true);
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [isLoading, businessName, empresaId, filters.startDate, filters.endDate, queryCacheKey, refreshKey]);

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
      startDate: '',
      endDate: '',
      clients: [],
      minAmount: null,
      maxAmount: null,
    });
    setGlobalFilter('');
  };

  const hasAmountFilter = filters.minAmount != null && filters.maxAmount != null;
  const hasActiveFilters = Boolean(
    filters.startDate || filters.endDate || filters.clients.length > 0 || hasAmountFilter
  );

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
            />
            <Button variant="outline" size="sm" className="h-8 border-dashed" disabled>
              <Download className="h-4 w-4" />
            </Button>
            {hasActiveFilters && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {filters.startDate && filters.endDate && (
                  <div className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    Periodo: {formatDate(filters.startDate)} - {formatDate(filters.endDate)}
                    <button
                      type="button"
                      className="text-blue-200 hover:text-white text-xs leading-none"
                      onClick={() => setFilters((prev) => ({ ...prev, startDate: '', endDate: '' }))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
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
          <div className="w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar..."
                className="w-full rounded-lg bg-background pl-8 md:w-[180px] h-8"
                value={globalFilter ?? ''}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(event.target.value)}
              />
            </div>
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
            </TableBody>
          </Table>
        </div>
      </div>

      {drawerRow ? <InvoiceDetailDrawer row={drawerRow} onClose={() => setDrawerRow(null)} /> : null}

    </div>
  );
}
