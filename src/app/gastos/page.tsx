"use client";

import React, { useState, useEffect, useRef } from 'react';
import StatCard from '@/components/StatCard';
import { ExpensesTable } from '@/components/ExpensesTable';
import { Button } from '@/components/ui/button';
import { ArrowDownCircle, FileText, RefreshCw } from 'lucide-react';
import Integrations from '@/components/Integrations';
import PageBanner from '@/components/PageBanner';
import { useInvoices } from '@/context/InvoiceContext';

const GastosPage = () => {
  const { setExpensesData } = useInvoices();
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [invoiceCount, setInvoiceCount] = useState<number>(0);
  const prevData = useRef({ total: 0, count: 0 });

  // Update the context when data changes
  useEffect(() => {
    if (prevData.current.total !== totalExpenses || prevData.current.count !== invoiceCount) {
      setExpensesData(totalExpenses, invoiceCount);
      prevData.current = { total: totalExpenses, count: invoiceCount };
    }
  }, [totalExpenses, invoiceCount, setExpensesData]);

  // Dynamic font size based on expenses value length
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
          <PageBanner title="Gastos" color="red" />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,6fr)] gap-6">
            <div className="flex flex-col gap-4 self-start sticky top-4">
              <StatCard 
                title="Gastos"
                value={`${totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`}
                Icon={ArrowDownCircle}
                size="compact"
                variant="red"
                showIcon={false}
                className={`${getExpensesFontSize(totalExpenses)} flex-shrink-0`}
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
                <Button className="bg-blue-600 hover:bg-blue-700">+ Subir gastos</Button>
              </div>
              <ExpensesTable 
                onTotalExpensesChange={setTotalExpenses}
                onInvoiceCountChange={setInvoiceCount}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GastosPage;
