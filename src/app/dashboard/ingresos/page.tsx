'use client';

import React, { useEffect, useRef } from 'react';
import StatCard from '@/components/StatCard';
import { IncomeTable } from '@/components/IncomeTable';
import { ArrowUpCircle, FileText, Link2, RefreshCw } from 'lucide-react';
import { useInvoices } from '@/context/InvoiceContext';
import InvoiceUploadDialog from '@/components/InvoiceUploadDialog';

const IngresosPage = () => {
  const { setIncomeData } = useInvoices();
  const [totalIncome, setTotalIncome] = React.useState<number>(0);
  const [invoiceCount, setInvoiceCount] = React.useState<number>(0);
  const [tableRefreshKey, setTableRefreshKey] = React.useState<number>(0);
  const prevData = useRef({ total: 0, count: 0 });

  useEffect(() => {
    if (prevData.current.total !== totalIncome || prevData.current.count !== invoiceCount) {
      setIncomeData(totalIncome, invoiceCount);
      prevData.current = { total: totalIncome, count: invoiceCount };
    }
  }, [totalIncome, invoiceCount, setIncomeData]);

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
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:justify-between gap-4 md:gap-6 max-w-5xl mx-auto">
              <StatCard
                title="Ingresos"
                value={`${totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`}
                Icon={ArrowUpCircle}
                size="compact"
                className={`md:w-[250px] ${getIncomeFontSize(totalIncome)}`}
              />
              <StatCard
                title="Facturas procesadas"
                value={invoiceCount.toString()}
                Icon={FileText}
                size="compact"
                className="md:w-[250px]"
              />
              <StatCard
                title="Conexiones"
                value={
                  <div className="flex items-center gap-3 -mt-2">
                    <img src="/brand/tab_ingresos/holded_logo.png" alt="Holded" className="h-8 w-8" />
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm md:text-base font-semibold text-inherit">Holded</span>
                      <span className="text-sm font-light text-green-500">Connected</span>
                    </div>
                  </div>
                }
                Icon={Link2}
                size="compact"
                showIcon={false}
                className="md:w-[250px]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center text-sm text-gray-500 gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Último escaneo hace 22 min</span>
                </div>
                <InvoiceUploadDialog type="Ingresos" onCreated={() => setTableRefreshKey((prev) => prev + 1)} />
              </div>
              <IncomeTable
                onTotalIncomeChange={setTotalIncome}
                onInvoiceCountChange={setInvoiceCount}
                refreshKey={tableRefreshKey}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IngresosPage;
