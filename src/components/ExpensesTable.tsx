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

const data: Expense[] = Array(8).fill({
  date: '07/10/2025',
  invoice: 'F2500061',
  provider: 'ErgoNatural SL',
  description: 'Servicios de post venta personal...',
  subtotal: '100€',
  total: '121€',
});

export type Expense = {
  date: string;
  invoice: string;
  provider: string;
  description: string;
  subtotal: string;
  total: string;
};

export const columns: ColumnDef<Expense>[] = [
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
  { accessorKey: 'provider', header: 'Proveedor' },
  { accessorKey: 'description', header: 'Descripción' },
  { accessorKey: 'subtotal', header: 'Subtotal' },
  { accessorKey: 'total', header: 'Total' },
  {
    id: 'actions',
    cell: () => (
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon">
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Download className="h-4 w-4" />
        </Button>
      </div>
    ),
  },
];

export function ExpensesTable() {
  const [rowSelection, setRowSelection] = React.useState({});

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
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            Filtros <span className="bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">3</span> <ChevronDown className="h-4 w-4" />
          </Button>
          <div className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full flex items-center gap-2">
            Proveedor: ErgoNatural SL <button>x</button>
          </div>
          <div className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full flex items-center gap-2">
            Periodo: 01/09/2025 - 01/10/2025 <button>x</button>
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
