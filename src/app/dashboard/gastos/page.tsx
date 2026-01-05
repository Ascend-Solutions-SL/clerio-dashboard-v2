"use client";

import React, { useState, useEffect, useRef } from 'react';
import StatCard from '@/components/StatCard';
import { ExpensesTable } from '@/components/ExpensesTable';
import { ArrowDownCircle, FileText, Link2, RefreshCw } from 'lucide-react';
import { useInvoices } from '@/context/InvoiceContext';
import InvoiceUploadDialog from '@/components/InvoiceUploadDialog';

const GastosPage = () => {
  const { setExpensesData } = useInvoices();
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [invoiceCount, setInvoiceCount] = useState<number>(0);
  const [tableRefreshKey, setTableRefreshKey] = useState<number>(0);
  const prevData = useRef({ total: 0, count: 0 });

  useEffect(() => {
    if (prevData.current.total !== totalExpenses || prevData.current.count !== invoiceCount) {
      setExpensesData(totalExpenses, invoiceCount);
      prevData.current = { total: totalExpenses, count: invoiceCount };
    }
  }, [totalExpenses, invoiceCount, setExpensesData]);

  const getExpensesFontSize = (value: number) => {
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
                title="Gastos"
                value={`${totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`}
                Icon={ArrowDownCircle}
                size="compact"
                className={`md:w-[250px] ${getExpensesFontSize(totalExpenses)}`}
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
                    <img src="/brand/tab_gastos/holded_logo.png" alt="Holded" className="h-8 w-8" />
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
                <InvoiceUploadDialog type="Gastos" onCreated={() => setTableRefreshKey((prev) => prev + 1)} />
              </div>
              <ExpensesTable
                onTotalExpensesChange={setTotalExpenses}
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

export default GastosPage;
