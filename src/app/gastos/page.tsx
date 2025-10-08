import React from 'react';
import StatCard from '@/components/StatCard';
import { ExpensesTable } from '@/components/ExpensesTable';
import { Button } from '@/components/ui/button';
import { ArrowDownCircle, FileText, RefreshCw } from 'lucide-react';
import Integrations from '@/components/Integrations';

const GastosPage = () => {
  return (
    <div>
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 flex flex-col gap-4 mt-12">
          <StatCard 
            title="Gastos"
            value="3260€"
            percentage={-16}
            Icon={ArrowDownCircle}
            size="md"
          />
          <StatCard 
            title="Facturas procesadas"
            value="167"
            percentage={-36}
            Icon={FileText}
            size="md"
          />
          <Integrations />
        </div>

        <div className="lg:col-span-9">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center text-sm text-gray-500 gap-2">
              <RefreshCw className="h-4 w-4" />
              <span>Último escaneo hace 22 min</span>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700">+ Subir gastos</Button>
          </div>
          <ExpensesTable />
        </div>
      </div>
    </div>
  );
}
;

export default GastosPage;
