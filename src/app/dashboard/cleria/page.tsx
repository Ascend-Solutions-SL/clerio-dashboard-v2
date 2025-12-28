"use client";

import ClerioChat from '@/components/ClerioChat';
import { Edit3, Search } from 'lucide-react';

const mockChats = [
  'Resumen de ingresos del mes',
  'Gastos deducibles Q4',
  'Facturación mensual pymes',
  'IVA: diferencias y alertas',
  'Conciliación bancaria',
  'Top proveedores y variación',
  'Previsión de tesorería',
  'Margen bruto por línea',
  'Cobros pendientes',
  'Comparativa año anterior',
  'Alertas de desviaciones',
  'Impuestos próximos',
];

export default function ClerIAPage() {
  return (
    <div className="h-full w-full bg-white">
      <div className="h-full overflow-hidden grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:flex flex-col bg-gray-50 text-gray-900 overflow-hidden border-r border-gray-200">
          <div className="px-4 pt-4 pb-3">
            <button
              type="button"
              className="w-full flex items-center gap-2 rounded-2xl hover:bg-gray-100 transition px-3 py-2 text-[13px] font-semibold text-gray-800"
            >
              <Edit3 className="h-4 w-4 text-gray-700" />
              Nuevo chat
            </button>

            <button
              type="button"
              className="mt-1 w-full flex items-center gap-2 rounded-2xl hover:bg-gray-100 transition px-3 py-2 text-[13px] font-semibold text-gray-700"
            >
              <Search className="h-4 w-4 text-gray-700" />
              Buscar chats
            </button>
          </div>

          <div className="px-4 pb-2">
            <p className="text-[11px] font-semibold tracking-wide text-gray-500">Tus chats</p>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <div className="space-y-1">
              {mockChats.map((title) => (
                <button
                  key={title}
                  type="button"
                  className="w-full text-left rounded-2xl px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-100 transition"
                >
                  <span className="block truncate">{title}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="h-full overflow-hidden p-6">
          <ClerioChat />
        </main>
      </div>
    </div>
  );
}
