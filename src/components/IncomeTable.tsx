'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from '@tanstack/react-table';
import { ChevronDown, Search, Eye, Download } from 'lucide-react';

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

export function IncomeTable() {
  const { user, isLoading } = useDashboardSession();
  const [data, setData] = React.useState<Income[]>([]);
  const [rowSelection, setRowSelection] = React.useState({});

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
      const { data: rows, error } = await supabase
        .from('facturas')
        .select('id, numero, fecha, cliente_proveedor, concepto, importe_sin_iva, importe_total')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'Ingresos')
        .order('fecha', { ascending: false })
        .returns<FacturaRow[]>();

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
        };
      });

      setData(mapped);
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [isLoading, user?.empresaId]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" className="flex items-center gap-1.5 text-sm h-9 px-3">
            <span className="leading-none">Filtros</span>
            <span className="bg-blue-600 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">3</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <div className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
            Cliente: ErgoNatural SL
            <button type="button" className="text-gray-400 text-xs leading-none">✕</button>
          </div>
          <div className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
            Periodo: 01/09/2025 - 01/10/2025
            <button type="button" className="text-gray-400 text-xs leading-none">✕</button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Búsqueda" className="pl-10" />
        </div>
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
