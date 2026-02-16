'use client';

import * as React from 'react';
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
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';
import { TableFilters } from '@/components/ui/table-filters';

const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
type DriveType = 'googledrive' | 'onedrive';

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

interface IncomeTableProps {
  onTotalIncomeChange?: (total: number) => void;
  onInvoiceCountChange?: (count: number) => void;
  refreshKey?: number;
}

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

type FacturaRow = {
  id: number;
  numero: string;
  fecha: string;
  buyer_tax_id: string | null;
  invoice_concept: string | null;
  importe_sin_iva: number | string | null;
  importe_total: number | string | null;
  drive_file_id?: string | null;
  drive_type?: DriveType | string | null;
};

export type Income = {
  id: number;
  date: string;
  rawDate?: string;
  invoice: string;
  client: string;
  description: string;
  subtotal: string;
  total: string;
  subtotalValue?: number;
  totalValue?: number;
  driveFileId?: string | null;
  driveType?: DriveType | null;
};

export const columns: ColumnDef<Income>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <div className="w-12 flex justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="w-12 flex justify-center">
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
      return (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block truncate cursor-zoom-in pr-2">{value}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs break-words text-sm">
              {value || 'Sin datos'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  { 
    accessorKey: 'client', 
    header: 'Cliente',
    cell: ({ getValue }) => {
      const value = getValue<string>() ?? '';
      return (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block truncate cursor-zoom-in pr-2">{value}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs break-words text-sm">
              {value || 'Sin datos'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    accessorKey: 'description',
    header: 'Descripción',
    cell: ({ getValue }) => {
      const value = getValue<string>() ?? '';
      return (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block truncate cursor-zoom-in pr-2">{value}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs break-words text-sm">
              {value || 'Sin descripción'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
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
    cell: ({ getValue }) => (
      <span className="block text-center font-semibold text-green-600">
        {getValue<string>()}
      </span>
    ),
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
    cell: ({ getValue }) => (
      <span className="block text-center font-semibold text-green-600">
        {getValue<string>()}
      </span>
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.totalValue ?? 0;
      const b = rowB.original.totalValue ?? 0;
      return a - b;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const driveFileId = row.original.driveFileId;
      const driveType = row.original.driveType;

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

      return (
        <div className="flex items-center space-x-2">
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
        </div>
      );
    },
  },
];

export function IncomeTable({ onTotalIncomeChange, onInvoiceCountChange, refreshKey = 0 }: IncomeTableProps) {
  const { user, isLoading } = useDashboardSession();
  const [data, setData] = React.useState<Income[]>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [dateRange, setDateRange] = React.useState<{ startDate: string; endDate: string }>({ 
    startDate: '', 
    endDate: '' 
  });

  const businessName = user?.businessName?.trim() || '';
  const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;


  // Load data and calculate total income
  React.useEffect(() => {
    const loadData = async () => {
      if (!businessName && empresaId == null) return;

      let query = supabase
        .from('facturas')
        .select('id, numero, fecha, buyer_tax_id, invoice_concept, importe_sin_iva, importe_total, drive_file_id, drive_type')
        .eq('tipo', 'Ingresos')
        .eq('source', 'ocr')
        .order('fecha', { ascending: false });

      if (empresaId != null && businessName) {
        query = query.or(`empresa_id.eq.${empresaId},user_businessname.eq.${businessName}`);
      } else {
        query = empresaId != null ? query.eq('empresa_id', empresaId) : query.eq('user_businessname', businessName);
      }

      const { data: facturas, error } = await query;

      if (error) {
        console.error('Error fetching invoices:', error);
        return;
      }
      if (!facturas) {
        console.log('No invoices found');
        return;
      }
      console.log('Fetched invoices:', facturas);

      // Calculate total income and count
      const total = (facturas as FacturaRow[]).reduce((sum: number, factura: FacturaRow) => {
        const amount = parseFloat(factura.importe_total as string) || 0;
        return sum + amount;
      }, 0);

      // Update parent components with total income and invoice count
      onTotalIncomeChange?.(total);
      onInvoiceCountChange?.(facturas.length);

      // Map to table data
      const mapped = (facturas as FacturaRow[]).map((row: FacturaRow) => {
        const subtotalValue = Number(row.importe_sin_iva ?? 0);
        const totalValue = Number(row.importe_total ?? 0);

        return {
          id: row.id,
          date: formatDate(row.fecha),
          rawDate: row.fecha,
          invoice: row.numero,
          client: row.buyer_tax_id ?? '',
          description: row.invoice_concept || '',
          subtotal: currencyFormatter.format(subtotalValue),
          total: currencyFormatter.format(totalValue),
          subtotalValue,
          totalValue,
          driveFileId: row.drive_file_id ?? null,
          driveType: (row.drive_type === 'onedrive' || row.drive_type === 'googledrive'
            ? row.drive_type
            : 'googledrive') as DriveType,
        };
      });

      setData(mapped);
    };

    void loadData();
  }, [businessName, empresaId, onTotalIncomeChange, onInvoiceCountChange, refreshKey]);

  // Apply date range filter
  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!businessName && empresaId == null) {
      setData([]);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      let query = supabase
        .from('facturas')
        .select('id, numero, fecha, buyer_tax_id, invoice_concept, importe_sin_iva, importe_total, drive_file_id, drive_type')
        .eq('tipo', 'Ingresos')
        .eq('source', 'ocr')
        .order('fecha', { ascending: false });

      if (empresaId != null && businessName) {
        query = query.or(`empresa_id.eq.${empresaId},user_businessname.eq.${businessName}`);
      } else {
        query = empresaId != null ? query.eq('empresa_id', empresaId) : query.eq('user_businessname', businessName);
      }

      // Aplicar filtro de rango de fechas si existe
      if (dateRange.startDate && dateRange.endDate) {
        query = query
          .gte('fecha', dateRange.startDate)
          .lte('fecha', dateRange.endDate);
      }

      const { data: rows, error } = await query;

      if (!isMounted) {
        return;
      }

      if (error || !rows) {
        setData([]);
        return;
      }

      const typedRows = rows as FacturaRow[];

      const mapped = typedRows.map((row: FacturaRow) => {
        const subtotalValue = Number(row.importe_sin_iva ?? 0);
        const totalValue = Number(row.importe_total ?? 0);

        return {
          id: row.id,
          date: formatDate(row.fecha),
          invoice: row.numero,
          client: row.buyer_tax_id ?? '',
          description: row.invoice_concept ?? '',
          subtotal: currencyFormatter.format(Number.isNaN(subtotalValue) ? 0 : subtotalValue),
          total: currencyFormatter.format(Number.isNaN(totalValue) ? 0 : totalValue),
          rawDate: row.fecha,
          subtotalValue: Number.isNaN(subtotalValue) ? 0 : subtotalValue,
          totalValue: Number.isNaN(totalValue) ? 0 : totalValue,
          driveFileId: row.drive_file_id ?? null,
          driveType: (row.drive_type === 'onedrive' || row.drive_type === 'googledrive'
            ? row.drive_type
            : 'googledrive') as DriveType,
        };
      });

      setData(mapped);
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [isLoading, businessName, empresaId, dateRange, refreshKey]);

  const table = useReactTable({
    data,
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

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
  };

  const resetFilters = () => {
    setDateRange({ startDate: '', endDate: '' });
    setGlobalFilter('');
  };

  const hasActiveFilters = dateRange.startDate || dateRange.endDate;

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex flex-col gap-4 mb-6">
        <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <TableFilters 
              onDateRangeChange={handleDateRangeChange}
              activeDateRange={dateRange}
              className="flex-1"
            />
            <Button variant="outline" size="sm" className="h-8" disabled>
              <Download className="h-4 w-4" />
            </Button>
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
        .table th:nth-child(4), .table td:nth-child(4) { width: 15%; } /* Cliente */
        .table th:nth-child(5), .table td:nth-child(5) { width: 25%; } /* Descripción */
        .table th:nth-child(6), .table td:nth-child(6) { width: 10%; min-width: 50px; } /* Subtotal */
        .table th:nth-child(7), .table td:nth-child(7) { width: 10%; min-width: 50px; } /* Total */
        .table th:nth-child(8), .table td:nth-child(8) { width: 10%; }  /* Acciones */
      `}</style>
      
      <div className="w-full overflow-x-auto pr-4">
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500">Filtros activos:</span>
            {dateRange.startDate && dateRange.endDate && (
              <div className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                Período: {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
                <button 
                  type="button" 
                  className="text-blue-200 hover:text-white text-xs leading-none"
                  onClick={() => setDateRange({ startDate: '', endDate: '' })}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <Button
              variant="ghost"
              onClick={resetFilters}
              className="h-8 px-2 lg:px-3 text-xs"
            >
              Reset filters
              <X className="ml-2 h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <div className="max-h-[520px] overflow-y-auto">
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="truncate text-left">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
