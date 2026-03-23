"use client";

import React, { useState, useEffect, useRef } from 'react';
import StatCard from '@/components/StatCard';
import { ExpensesTable } from '@/components/ExpensesTable';
import { ArrowDownCircle, FileText, Link2 } from 'lucide-react';
import { useInvoices } from '@/context/InvoiceContext';
import InvoiceUploadDialog from '@/components/InvoiceUploadDialog';
import InvoiceScanControls from '@/components/InvoiceScanControls';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';

const holdedStatusCache = new Map<string, boolean>();
const gastosCardsCache = new Map<string, { total: number; count: number }>();

const parseAmount = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let normalized = String(value).trim().replace(/[\s€]/g, '');
  if (!normalized) return 0;

  const isNegative = normalized.startsWith('-') || (normalized.startsWith('(') && normalized.endsWith(')'));
  normalized = normalized.replace(/[()]/g, '').replace(/^[+-]/, '');

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  const dotCount = (normalized.match(/\./g) ?? []).length;
  const commaCount = (normalized.match(/,/g) ?? []).length;

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = normalized.split(thousandsSeparator).join('');
    if (decimalSeparator === ',') {
      normalized = normalized.replace(',', '.');
    }
  } else if (lastComma !== -1) {
    if (commaCount > 1) {
      const parts = normalized.split(',');
      const last = parts[parts.length - 1] ?? '';
      if (last.length <= 2) {
        normalized = `${parts.slice(0, -1).join('')}.${last}`;
      } else {
        normalized = parts.join('');
      }
    } else {
    const isThousandsOnly = /^\d{1,3}(,\d{3})+$/.test(normalized);
    if (isThousandsOnly) {
      normalized = normalized.split(',').join('');
    } else {
      normalized = normalized.split('.').join('');
      normalized = normalized.replace(',', '.');
    }
    }
  } else if (lastDot !== -1) {
    if (dotCount > 1) {
      const parts = normalized.split('.');
      const last = parts[parts.length - 1] ?? '';
      if (last.length <= 2) {
        normalized = `${parts.slice(0, -1).join('')}.${last}`;
      } else {
        normalized = parts.join('');
      }
    } else {
      const isThousandsOnly = /^\d{1,3}(\.\d{3})+$/.test(normalized);
      if (isThousandsOnly) {
        normalized = normalized.split('.').join('');
      }
    }
  }

  normalized = normalized.replace(/[^0-9.]/g, '');

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return isNegative ? -parsed : parsed;
};

const GastosPage = () => {
  const { setExpensesData } = useInvoices();
  const { user } = useDashboardSession();
  const holdedCacheKey = user?.id ?? 'anonymous';
  const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;
  const cardsCacheKey = `${empresaId ?? 'none'}`;
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [invoiceCount, setInvoiceCount] = useState<number>(0);
  const [cardsLoading, setCardsLoading] = useState<boolean>(() => !gastosCardsCache.has(cardsCacheKey));
  const [tableRefreshKey, setTableRefreshKey] = useState<number>(0);
  const [isHoldedConnected, setIsHoldedConnected] = useState<boolean | null>(() => {
    const cached = holdedStatusCache.get(holdedCacheKey);
    return cached === undefined ? null : cached;
  });
  const prevData = useRef({ total: 0, count: 0 });

  useEffect(() => {
    const cached = gastosCardsCache.get(cardsCacheKey);
    if (!cached) {
      return;
    }
    setTotalExpenses(cached.total);
    setInvoiceCount(cached.count);
    setCardsLoading(false);
  }, [cardsCacheKey]);

  useEffect(() => {
    if (prevData.current.total !== totalExpenses || prevData.current.count !== invoiceCount) {
      setExpensesData(totalExpenses, invoiceCount);
      prevData.current = { total: totalExpenses, count: invoiceCount };
    }
  }, [totalExpenses, invoiceCount, setExpensesData]);

  useEffect(() => {
    if (empresaId == null) {
      setTotalExpenses(0);
      setInvoiceCount(0);
      setCardsLoading(false);
      return;
    }

    let isMounted = true;

    const loadCards = async () => {
      const cached = gastosCardsCache.get(cardsCacheKey);
      if (!cached) {
        setCardsLoading(true);
      }
      try {
        const countPromise = supabase
          .from('facturas')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .eq('tipo', 'Gastos');

        const { count: countedRows } = await countPromise;

        const expectedRows = countedRows ?? 0;
        let total = 0;
        let from = 0;
        const chunk = 1000;
        while (from < expectedRows) {
          const { data: rows, error } = await supabase
            .from('facturas')
            .select('importe_total')
            .eq('empresa_id', empresaId)
            .eq('tipo', 'Gastos')
            .range(from, from + chunk - 1);

          if (error || !rows) {
            break;
          }

          total += (rows as Array<{ importe_total: unknown }>).reduce(
            (acc, row) => acc + Math.abs(parseAmount(row.importe_total)),
            0
          );

          if (rows.length === 0) {
            break;
          }
          from += chunk;
        }

        if (!isMounted) {
          return;
        }

        const nextCount = countedRows ?? 0;
        const nextTotals = { total, count: nextCount };
        gastosCardsCache.set(cardsCacheKey, nextTotals);

        setInvoiceCount((prev) => (prev === nextCount ? prev : nextCount));
        setTotalExpenses((prev) => (prev === total ? prev : total));
      } finally {
        if (isMounted) {
          setCardsLoading(false);
        }
      }
    };

    void loadCards();

    return () => {
      isMounted = false;
    };
  }, [cardsCacheKey, empresaId, tableRefreshKey]);

  useEffect(() => {
    let isMounted = true;

    const loadHoldedStatus = async () => {
      const cached = holdedStatusCache.get(holdedCacheKey);
      if (isMounted && cached !== undefined) {
        setIsHoldedConnected(cached);
      }

      try {
        const response = await fetch('/api/holded/key', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          if (isMounted && cached === undefined) {
            setIsHoldedConnected(false);
            holdedStatusCache.set(holdedCacheKey, false);
          }
          return;
        }

        const payload = (await response.json()) as { connected?: boolean };
        if (isMounted) {
          const nextConnected = Boolean(payload.connected);
          setIsHoldedConnected(nextConnected);
          holdedStatusCache.set(holdedCacheKey, nextConnected);
        }
      } catch {
        if (isMounted && cached === undefined) {
          setIsHoldedConnected(false);
          holdedStatusCache.set(holdedCacheKey, false);
        }
      }
    };

    void loadHoldedStatus();

    return () => {
      isMounted = false;
    };
  }, [holdedCacheKey, tableRefreshKey]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ connected?: boolean }>;
      if (typeof customEvent.detail?.connected === 'boolean') {
        setIsHoldedConnected(customEvent.detail.connected);
        holdedStatusCache.set(holdedCacheKey, customEvent.detail.connected);
      }
    };

    window.addEventListener('holded-status-changed', handler);
    return () => {
      window.removeEventListener('holded-status-changed', handler);
    };
  }, [holdedCacheKey]);

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
                value={cardsLoading ? '—' : `${totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`}
                Icon={ArrowDownCircle}
                size="compact"
                className={`md:w-[250px] ${getExpensesFontSize(totalExpenses)}`}
              />
              <StatCard
                title="Facturas procesadas"
                value={cardsLoading ? '—' : invoiceCount.toString()}
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
                      <span
                        className={`text-sm font-light ${
                          isHoldedConnected === null ? 'text-gray-500' : isHoldedConnected ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {isHoldedConnected === null ? 'Cargando...' : isHoldedConnected ? 'Conectado' : 'Desconectado'}
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
                <InvoiceScanControls onScanned={() => setTableRefreshKey((prev) => prev + 1)} />
                <div className="flex justify-end">
                  <InvoiceUploadDialog type="Gastos" onCreated={() => setTableRefreshKey((prev) => prev + 1)} />
                </div>
              </div>
              <ExpensesTable
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
