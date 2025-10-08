import React from 'react';
import StatCard from '@/components/StatCard';
import { ExpensesTable } from '@/components/ExpensesTable';
import { Button } from '@/components/ui/button';
import { ArrowDownCircle, FileText, RefreshCw } from 'lucide-react';
import { FaHeart } from 'react-icons/fa';

const GastosPage = () => {
  return (
    <div>
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
        <StatCard 
          title="Integración"
          value="Holded"
          Icon={FaHeart}
          statusText="Connected"
          iconColor="text-red-500"
        />
      </div>

      <div className="max-w-5xl mx-auto flex justify-between items-center mb-6 px-1">
        <div className="flex items-center text-sm text-gray-500 gap-2">
          <RefreshCw className="h-4 w-4" />
          <span>Último escaneo hace 22 min</span>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          + Subir gastos
        </Button>
      </div>

      <div className="max-w-5xl mx-auto">
        <ExpensesTable />
      </div>
    </div>
  );
};

export default GastosPage;
