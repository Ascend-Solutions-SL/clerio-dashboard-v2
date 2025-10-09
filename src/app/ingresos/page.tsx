import React from 'react';
import StatCard from '@/components/StatCard';
import { IncomeTable } from '@/components/IncomeTable';
import { Button } from '@/components/ui/button';
import Integrations from '@/components/Integrations';
import PageBanner from '@/components/PageBanner';
import { ArrowUpCircle, FileText, RefreshCw } from 'lucide-react';

const IngresosPage = () => {
  return (
    <div className="-m-8">
      <div className="bg-white pt-8 pb-10">
        <div className="max-w-6xl mx-auto px-6">
          <PageBanner title="Ingresos" color="green" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 flex flex-col gap-4">
              <StatCard 
                title="Ingresos"
                value="8070€"
                percentage={41}
                Icon={ArrowUpCircle}
                size="md"
                variant="green"
                showIcon={false}
              />
              <StatCard 
                title="Facturas procesadas"
                value="260"
                percentage={22}
                Icon={FileText}
                size="md"
                showIcon={false}
              />
              <Integrations />
            </div>

            <div className="lg:col-span-9">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center text-sm text-gray-500 gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Último escaneo hace 22 min</span>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">+ Subir ingresos</Button>
              </div>
              <IncomeTable />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IngresosPage;
