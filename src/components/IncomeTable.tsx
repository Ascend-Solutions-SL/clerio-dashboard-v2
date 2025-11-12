'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';
import { ChevronDown, Search, Eye, Download, X } from 'lucide-react';

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
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';
import { TableFilters } from '@/components/ui/table-filters';

const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

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
  cliente_proveedor: string;
  concepto: string | null;
  importe_sin_iva: number | string | null;
  importe_total: number | string | null;
};

export type Income = {
  id: number;
  date: string;
  invoice: string;
  client: string;
  description: string;
  subtotal: string;
  total: string;
};

export const columns: ColumnDef<Income>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  { accessorKey: 'date', header: 'Fecha' },
  { accessorKey: 'invoice', header: 'Nº Factura' },
  { accessorKey: 'client', header: 'Cliente' },
  { accessorKey: 'description', header: 'Descripción' },
  {
    accessorKey: 'subtotal',
    header: () => <div className="text-center">Subtotal</div>,
    cell: ({ getValue }) => (
      <span className="block text-center font-semibold text-green-600">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'total',
    header: () => <div className="text-center">Total</div>,
    cell: ({ getValue }) => (
      <span className="block text-center font-semibold text-green-600">{getValue<string>()}</span>
    ),
  },
  {
    id: 'actions',
    cell: () => {
      return (
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  },
];

interface Client {
  id: string;
  name: string;
}

export function IncomeTable() {
  const { user, isLoading } = useDashboardSession();
  const [data, setData] = React.useState<Income[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [clientFilter, setClientFilter] = React.useState('');
  const [dateRange, setDateRange] = React.useState<{ startDate: string; endDate: string }>({ 
    startDate: '', 
    endDate: '' 
  });

  // Cargar clientes únicos
  React.useEffect(() => {
    const loadClients = async () => {
      if (isLoading || !user?.empresaId) return;

      const { data: facturas, error } = await supabase
        .from('facturas')
        .select('cliente_proveedor')
        .eq('empresa_id', user.empresaId)
        .eq('tipo', 'Ingresos');

      if (error || !facturas) return;

      // Obtener clientes únicos
      const uniqueClients = Array.from(
        new Map(
          facturas
            .filter(f => f.cliente_proveedor)
            .map(f => [f.cliente_proveedor, f.cliente_proveedor])
        ).entries()
      ).map(([id, name]) => ({ id, name }));

      setClients(uniqueClients);
    };

    void loadClients();
  }, [isLoading, user?.empresaId]);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    const empresaId = user?.empresaId ? Number(user.empresaId) : null;

    if (!empresaId) {
      setData([]);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      let query = supabase
        .from('facturas')
        .select('id, numero, fecha, cliente_proveedor, concepto, importe_sin_iva, importe_total')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'Ingresos')
        .order('fecha', { ascending: false });

      // Aplicar filtro de cliente si existe
      if (clientFilter) {
        query = query.eq('cliente_proveedor', clientFilter);
      }

      // Aplicar filtro de rango de fechas si existe
      if (dateRange.startDate && dateRange.endDate) {
        query = query
          .gte('fecha', dateRange.startDate)
          .lte('fecha', dateRange.endDate);
      }

      const { data: rows, error } = await query.returns<FacturaRow[]>();

      if (!isMounted) {
        return;
      }

      if (error || !rows) {
        setData([]);
        return;
      }

      const mapped = rows.map((row) => {
        const subtotalValue = Number(row.importe_sin_iva ?? 0);
        const totalValue = Number(row.importe_total ?? 0);

        return {
          id: row.id,
          date: formatDate(row.fecha),
          invoice: row.numero,
          client: row.cliente_proveedor,
          description: row.concepto ?? '',
          subtotal: currencyFormatter.format(Number.isNaN(subtotalValue) ? 0 : subtotalValue),
          total: currencyFormatter.format(Number.isNaN(totalValue) ? 0 : totalValue),
          rawDate: row.fecha, // Para facilitar el filtrado por fecha
        };
      });

      setData(mapped);
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [isLoading, user?.empresaId, clientFilter, dateRange]);

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      globalFilter,
    },
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleClientChange = (clientId: string) => {
    setClientFilter(clientId);
  };

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
  };

  const resetFilters = () => {
    setClientFilter('');
    setDateRange({ startDate: '', endDate: '' });
    setGlobalFilter('');
  };

  const hasActiveFilters = clientFilter || dateRange.startDate || dateRange.endDate;

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex items-center gap-4">
            <TableFilters 
              clients={clients}
              onClientChange={handleClientChange}
              onDateRangeChange={handleDateRangeChange}
            />
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Buscar..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500">Filtros activos:</span>
            {clientFilter && (
              <div className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                Cliente: {clients.find(c => c.id === clientFilter)?.name || clientFilter}
                <button 
                  type="button" 
                  className="text-blue-400 hover:text-blue-600 text-xs leading-none"
                  onClick={() => setClientFilter('')}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {dateRange.startDate && dateRange.endDate && (
              <div className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                Período: {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
                <button 
                  type="button" 
                  className="text-blue-400 hover:text-blue-600 text-xs leading-none"
                  onClick={() => setDateRange({ startDate: '', endDate: '' })}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-6 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              onClick={resetFilters}
            >
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
