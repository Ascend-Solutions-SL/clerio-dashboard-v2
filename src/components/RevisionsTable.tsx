'use client';
import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Search, Eye, Download, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RevisionDetailsDialog, type FacturaDetails } from '@/components/RevisionDetailsDialog';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';

type DriveType = 'googledrive' | 'onedrive';

type FacturaRow = {
  id: number;
  numero: string;
  fecha: string;
  tipo: string;
  cliente_proveedor: string;
  concepto: string | null;
  importe_sin_iva: number | string | null;
  iva: number | string | null;
  importe_total: number | string | null;
  factura_uid: string | null;
  analysis_reason: string | null;
  drive_file_id?: string | null;
  drive_type?: DriveType | string | null;
};

type RevisionRow = {
  id: number;
  rawDate: string;
  tipo: string;
  numero: string;
  clienteProveedor: string;
  concepto: string;
  importeSinIva: number | string | null;
  iva: number | string | null;
  importeTotal: number | string | null;
  facturaUid: string;
  analysisReason: string;
  driveFileId: string | null;
  driveType: DriveType | null;
};

const getTipoBadgeClasses = (tipo: string) => {
  if (tipo === 'Por Revisar') {
    return 'bg-amber-100 text-amber-950 border-amber-300';
  }

  if (tipo === 'No Factura') {
    return 'bg-violet-100 text-violet-950 border-violet-300';
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

const SortIndicator = ({ state }: { state: false | 'asc' | 'desc' }) => (
  <span aria-hidden className={`text-xs transition-colors ${state ? 'text-gray-600' : 'text-gray-300'}`}>
    {state === 'asc' ? '↑' : state === 'desc' ? '↓' : '↕'}
  </span>
);

interface RevisionsTableProps {
  onPorRevisarCountChange?: (count: number) => void;
  onNoFacturasCountChange?: (count: number) => void;
  selectedId?: number | null;
  onSelect?: (id: number, row: RevisionRow) => void;
  onDataLoaded?: (rows: RevisionRow[]) => void;
  refreshKey?: number;
}

export function RevisionsTable({
  onPorRevisarCountChange,
  onNoFacturasCountChange,
  selectedId = null,
  onSelect,
  onDataLoaded,
  refreshKey = 0,
}: RevisionsTableProps) {
  const { user, isLoading } = useDashboardSession();
  const [data, setData] = React.useState<RevisionRow[]>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [tipoFilter, setTipoFilter] = React.useState<'all' | 'Por Revisar' | 'No Factura'>('all');

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsFactura, setDetailsFactura] = React.useState<FacturaDetails | null>(null);
  const [detailsRefreshKey, setDetailsRefreshKey] = React.useState(0);

  const businessName = user?.businessName?.trim() || '';

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!businessName) {
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
          'id, numero, fecha, tipo, cliente_proveedor, concepto, importe_sin_iva, iva, importe_total, factura_uid, analysis_reason, drive_file_id, drive_type'
        )
        .eq('user_businessname', businessName)
        .in('tipo', ['Por Revisar', 'No Factura'])
        .order('fecha', { ascending: false });

      if (tipoFilter !== 'all') {
        query = query.eq('tipo', tipoFilter);
      }

      const { data: rows, error } = await query;

      if (!isMounted) {
        return;
      }

      if (error || !rows) {
        setData([]);
        onPorRevisarCountChange?.(0);
        onNoFacturasCountChange?.(0);
        return;
      }

      const typedRows = rows as FacturaRow[];

      const porRevisarCount = typedRows.filter((r) => r.tipo === 'Por Revisar').length;
      const noFacturasCount = typedRows.filter((r) => r.tipo === 'No Factura').length;

      onPorRevisarCountChange?.(porRevisarCount);
      onNoFacturasCountChange?.(noFacturasCount);

      const mapped: RevisionRow[] = typedRows.map((row) => {
        const resolvedDriveType =
          row.drive_type === 'onedrive' || row.drive_type === 'googledrive' ? (row.drive_type as DriveType) : null;

        return {
          id: row.id,
          rawDate: row.fecha,
          tipo: row.tipo,
          numero: row.numero,
          clienteProveedor: row.cliente_proveedor,
          concepto: row.concepto ?? '',
          importeSinIva: row.importe_sin_iva ?? null,
          iva: row.iva ?? null,
          importeTotal: row.importe_total ?? null,
          facturaUid: row.factura_uid ?? '',
          analysisReason: row.analysis_reason ?? '',
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
  }, [isLoading, businessName, tipoFilter, refreshKey, detailsRefreshKey, onPorRevisarCountChange, onNoFacturasCountChange]);

  const resetFilters = () => {
    setTipoFilter('all');
    setGlobalFilter('');
  };

  const hasActiveFilters = tipoFilter !== 'all';

  const columns = React.useMemo<ColumnDef<RevisionRow>[]>(
    () => [
      {
        accessorKey: 'facturaUid',
        header: ({ column }) => {
          const sortState = column.getIsSorted();
          return (
            <button
              type="button"
              className="flex items-center gap-1 font-semibold"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Revisión
              <SortIndicator state={sortState} />
            </button>
          );
        },
        cell: ({ row }) => {
          const facturaUid = row.original.facturaUid;
          const reason = row.original.analysisReason;
          const tipo = row.original.tipo;

          return (
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getTipoBadgeClasses(
                    tipo
                  )}`}
                >
                  {tipo === 'Por Revisar' ? 'Por revisar' : tipo === 'No Factura' ? 'No factura' : tipo}
                </span>
                <div className="font-semibold text-gray-900 truncate min-w-0">{facturaUid || 'Sin UID'}</div>
              </div>
              <div className="mt-0.5 text-sm text-gray-500 truncate">{reason || 'Sin motivo'}</div>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => (rowA.original.rawDate ?? '').localeCompare(rowB.original.rawDate ?? ''),
        size: 9999,
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const driveFileId = row.original.driveFileId;
          const driveType = row.original.driveType;

          const downloadHref =
            driveFileId && driveType
              ? `/api/files/open?drive_type=${encodeURIComponent(driveType)}&drive_file_id=${encodeURIComponent(
                  driveFileId
                )}&kind=download`
              : undefined;

          const handleDownload = () => {
            if (!downloadHref) {
              return;
            }
            window.open(downloadHref, '_blank', 'noopener,noreferrer');
          };

          const canOpen = Boolean(driveFileId && driveType);

          return (
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Revisar campos"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailsFactura({
                    id: row.original.id,
                    numero: row.original.numero,
                    fecha: row.original.rawDate,
                    tipo: row.original.tipo,
                    cliente_proveedor: row.original.clienteProveedor,
                    concepto: row.original.concepto,
                    importe_sin_iva: row.original.importeSinIva,
                    iva: row.original.iva,
                    importe_total: row.original.importeTotal,
                  });
                  setDetailsOpen(true);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
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
        size: 80,
        minSize: 80,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
    },
    initialState: {
      sorting: [
        {
          id: 'facturaUid',
          desc: false,
        },
      ],
    },
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
    <div className="relative h-full flex flex-col overflow-hidden bg-white p-6 rounded-lg border border-gray-200">
      <RevisionDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        factura={detailsFactura}
        onSaved={() => {
          setDetailsRefreshKey((prev) => prev + 1);
        }}
      />
      <div className="flex flex-col gap-3 mb-4">
        <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={tipoFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => setTipoFilter('all')}
              >
                Ambos
              </Button>
              <Button
                type="button"
                variant={tipoFilter === 'Por Revisar' ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => setTipoFilter('Por Revisar')}
              >
                Por Revisar
              </Button>
              <Button
                type="button"
                variant={tipoFilter === 'No Factura' ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => setTipoFilter('No Factura')}
              >
                No Factura
              </Button>
            </div>
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
          width: auto;
        }

        .revisions-table th:nth-child(2),
        .revisions-table td:nth-child(2) {
          width: 96px;
          min-width: 96px;
        }
      `}</style>

      <div className="flex-1 min-h-0 rounded-md border overflow-x-auto">
        <div className="h-full overflow-y-auto">
          <Table className="revisions-table">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="truncate text-left">
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
                  }}
                >
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
