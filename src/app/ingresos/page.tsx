'use client';

import React from 'react';
import StatCard from '@/components/StatCard';
import { IncomeTable } from '@/components/IncomeTable';
import { Button } from '@/components/ui/button';
import Integrations from '@/components/Integrations';
import PageBanner from '@/components/PageBanner';
import { ArrowUpCircle, FileText, RefreshCw } from 'lucide-react';

const IngresosPage = () => {
  const [totalIncome, setTotalIncome] = React.useState<number>(0);
  const [invoiceCount, setInvoiceCount] = React.useState<number>(0);

  // Dynamic font size based on income value length
  const getIncomeFontSize = (value: number) => {
    const valueStr = value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (valueStr.length > 10) return 'text-xs';
    if (valueStr.length > 8) return 'text-sm';
    return 'text-base';
  };

  return (
    <div className="-m-8">
      <div className="bg-white pt-8 pb-10">
        <div className="max-w-7xl mx-auto px-6">
          <PageBanner title="Ingresos" color="green" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,6fr)] gap-6">
            <div className="flex flex-col gap-4 self-start sticky top-4">
              <StatCard 
                title="Ingresos"
                value={`${totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`}
                Icon={ArrowUpCircle}
                size="compact"
                variant="green"
                showIcon={false}
                className={`${getIncomeFontSize(totalIncome)} flex-shrink-0`}
              />
              <StatCard 
                title="Nº Facturas"
                value={invoiceCount.toString()}
                Icon={FileText}
                size="compact"
                showIcon={false}
                className="text-sm flex-shrink-0"
              />
              <Integrations />
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center text-sm text-gray-500 gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Último escaneo hace 22 min</span>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">+ Subir ingresos</Button>
              </div>
              <IncomeTable 
                onTotalIncomeChange={setTotalIncome} 
                onInvoiceCountChange={setInvoiceCount} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IngresosPage;
