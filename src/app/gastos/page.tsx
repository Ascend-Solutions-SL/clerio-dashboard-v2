import React from 'react';
import StatCard from '@/components/StatCard';
import { ExpensesTable } from '@/components/ExpensesTable';
import { Button } from '@/components/ui/button';
import { ArrowDownCircle, FileText } from 'lucide-react';

const GastosPage = () => {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard 
          title="Gastos"
          value="3260€"
          percentage={-16}
          Icon={ArrowDownCircle}
        />
        <StatCard 
          title="Facturas procesadas"
          value="167"
          percentage={-36}
          Icon={FileText}
        />
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">Último escaneo hace 22 min</div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          + Subir gastos
        </Button>
      </div>

      <ExpensesTable />
    </div>
  );
};

export default GastosPage;
