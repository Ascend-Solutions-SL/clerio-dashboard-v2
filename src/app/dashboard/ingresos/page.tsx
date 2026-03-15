'use client';

import React, { useEffect, useRef } from 'react';
import StatCard from '@/components/StatCard';
import { IncomeTable } from '@/components/IncomeTable';
import { ArrowUpCircle, FileText, Link2 } from 'lucide-react';
import { useInvoices } from '@/context/InvoiceContext';
import InvoiceUploadDialog from '@/components/InvoiceUploadDialog';
import InvoiceScanControls from '@/components/InvoiceScanControls';

const IngresosPage = () => {
  const { setIncomeData } = useInvoices();
  const [totalIncome, setTotalIncome] = React.useState<number>(0);
  const [invoiceCount, setInvoiceCount] = React.useState<number>(0);
  const [tableRefreshKey, setTableRefreshKey] = React.useState<number>(0);
  const [isHoldedConnected, setIsHoldedConnected] = React.useState<boolean | null>(null);
  const prevData = useRef({ total: 0, count: 0 });

  useEffect(() => {
    if (prevData.current.total !== totalIncome || prevData.current.count !== invoiceCount) {
      setIncomeData(totalIncome, invoiceCount);
      prevData.current = { total: totalIncome, count: invoiceCount };
    }
  }, [totalIncome, invoiceCount, setIncomeData]);

  useEffect(() => {
    let isMounted = true;

    const loadHoldedStatus = async () => {
      try {
        if (isMounted) setIsHoldedConnected(null);
        const response = await fetch('/api/holded/key', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          if (isMounted) setIsHoldedConnected(false);
          return;
        }

        const payload = (await response.json()) as { connected?: boolean };
        if (isMounted) {
          setIsHoldedConnected(Boolean(payload.connected));
        }
      } catch {
        if (isMounted) setIsHoldedConnected(false);
      }
    };

    void loadHoldedStatus();

    return () => {
      isMounted = false;
    };
  }, [tableRefreshKey]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ connected?: boolean }>;
      if (typeof customEvent.detail?.connected === 'boolean') {
        setIsHoldedConnected(customEvent.detail.connected);
      }
    };

    window.addEventListener('holded-status-changed', handler);
    return () => {
      window.removeEventListener('holded-status-changed', handler);
    };
  }, []);

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
                      <span
                        className={`text-sm font-light ${
                          isHoldedConnected === null ? 'text-gray-500' : isHoldedConnected ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {isHoldedConnected === null ? 'Cargando...' : isHoldedConnected ? 'Connected' : 'Disconnected'}
                      </span>
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
              <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
                <InvoiceScanControls showHoldedScan onScanned={() => setTableRefreshKey((prev) => prev + 1)} />
                <div className="flex justify-end">
                  <InvoiceUploadDialog type="Ingresos" onCreated={() => setTableRefreshKey((prev) => prev + 1)} />
                </div>
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
