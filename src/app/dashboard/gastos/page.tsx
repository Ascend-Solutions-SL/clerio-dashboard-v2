"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import StatCard from '@/components/StatCard';
import { ExpensesTable } from '@/components/ExpensesTable';
import { ArrowDownCircle, FileText, Link2 } from 'lucide-react';
import { useInvoices } from '@/context/InvoiceContext';
import InvoiceUploadDialog from '@/components/InvoiceUploadDialog';
import InvoiceScanControls from '@/components/InvoiceScanControls';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';
import { type DateRangeValue } from '@/components/ui/date-range-selector';
import {
  getInitialSharedDashboardDateRange,
  getSharedDashboardDateRangeFromStorage,
  setSharedDashboardDateRange,
} from '@/lib/dashboard-date-range';

const gastosCardsCache = new Map<string, { total: number; count: number }>();

type EmailType = 'gmail' | 'outlook';

const emailTypeCache = new Map<string, EmailType | null>();

const normalizeEmailType = (value: unknown): EmailType | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'gmail' || normalized === 'outlook') {
    return normalized;
  }
  return null;
};

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
  const emailTypeCacheKey = user?.id ?? 'anonymous';
  const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;
  const [dateRange, setDateRange] = useState<DateRangeValue>(getInitialSharedDashboardDateRange);
  const cardsCacheKey = `${empresaId ?? 'none'}::${dateRange.startDate}::${dateRange.endDate}`;
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [invoiceCount, setInvoiceCount] = useState<number>(0);
  const [cardsLoading, setCardsLoading] = useState<boolean>(() => !gastosCardsCache.has(cardsCacheKey));
  const [tableRefreshKey, setTableRefreshKey] = useState<number>(0);
  const [emailType, setEmailType] = useState<EmailType | null>(() => {
    const cached = emailTypeCache.get(emailTypeCacheKey);
    return cached === undefined ? null : cached;
  });
  const prevData = useRef({ total: 0, count: 0 });

  const handleDateRangeChange = React.useCallback((next: DateRangeValue) => {
    setDateRange((prev) => {
      if (prev.startDate === next.startDate && prev.endDate === next.endDate) {
        return prev;
      }

      setSharedDashboardDateRange(next);
      return next;
    });
  }, []);

  const handleRealtimeProgressUpdate = React.useCallback(() => {
    setTableRefreshKey((prev) => prev + 1);
  }, []);

  const handleInvoiceTrashedOptimistic = React.useCallback((payload: { invoiceId: number; amount: number }) => {
    const nextAmount = Math.max(0, payload.amount);

    setInvoiceCount((prev) => {
      const nextCount = Math.max(0, prev - 1);
      const cached = gastosCardsCache.get(cardsCacheKey);
      gastosCardsCache.set(cardsCacheKey, {
        total: cached ? Math.max(0, cached.total - nextAmount) : Math.max(0, totalExpenses - nextAmount),
        count: cached ? Math.max(0, cached.count - 1) : nextCount,
      });
      return nextCount;
    });

    setTotalExpenses((prev) => Math.max(0, prev - nextAmount));
  }, [cardsCacheKey, totalExpenses]);

  React.useEffect(() => {
    const storedRange = getSharedDashboardDateRangeFromStorage();
    setDateRange((prev) =>
      prev.startDate === storedRange.startDate && prev.endDate === storedRange.endDate ? prev : storedRange
    );
  }, []);

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
        let countQuery = supabase
          .from('facturas')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .eq('tipo', 'Gastos')
          .eq('is_trashed', false);

        if (dateRange.startDate && dateRange.endDate) {
          countQuery = countQuery.gte('fecha', dateRange.startDate).lte('fecha', dateRange.endDate);
        }

        const { count: countedRows } = await countQuery;

        const expectedRows = countedRows ?? 0;
        let total = 0;
        let from = 0;
        const chunk = 1000;
        while (from < expectedRows) {
          let sumQuery = supabase
            .from('facturas')
            .select('importe_total')
            .eq('empresa_id', empresaId)
            .eq('tipo', 'Gastos')
            .eq('is_trashed', false)
            .range(from, from + chunk - 1);

          if (dateRange.startDate && dateRange.endDate) {
            sumQuery = sumQuery.gte('fecha', dateRange.startDate).lte('fecha', dateRange.endDate);
          }

          const { data: rows, error } = await sumQuery;

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
  }, [cardsCacheKey, dateRange.endDate, dateRange.startDate, empresaId, tableRefreshKey]);

  useEffect(() => {
    let isMounted = true;

    const loadEmailType = async () => {
      if (!user?.id) {
        if (isMounted) {
          setEmailType(null);
        }
        return;
      }

      const cached = emailTypeCache.get(emailTypeCacheKey);
      if (isMounted && cached !== undefined) {
        setEmailType(cached);
      }

      const { data, error } = await supabase
        .from('auth_users')
        .select('email_type')
        .eq('user_uid', user.id)
        .maybeSingle();

      if (error) {
        return;
      }

      const nextEmailType = normalizeEmailType((data as { email_type?: unknown } | null)?.email_type);

      emailTypeCache.set(emailTypeCacheKey, nextEmailType);
      if (isMounted) {
        setEmailType(nextEmailType);
      }
    };

    void loadEmailType();

    return () => {
      isMounted = false;
    };
  }, [emailTypeCacheKey, user?.id]);

  const getExpensesFontSize = (value: number) => {
    const valueStr = value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (valueStr.length > 10) return 'text-xs';
    if (valueStr.length > 8) return 'text-sm';
    return 'text-base';
  };

  const isOutlook = emailType === 'outlook';
  const primaryLogoSrc = isOutlook ? '/brand/tab_gastos/outlook_logo.png' : '/brand/tab_gastos/gmail_logo.png';
  const primaryLabel = isOutlook ? 'Outlook' : 'Gmail';
  const isConfigured = emailType !== null;

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
                title="Facturas"
                value={cardsLoading ? '—' : invoiceCount.toString()}
                Icon={FileText}
                size="compact"
                className="md:w-[250px]"
              />
              <StatCard
                title="Conexiones"
                value={
                  <div className="flex items-center gap-3 -mt-2">
                    <Image src={primaryLogoSrc} alt={primaryLabel} width={32} height={32} className="h-8 w-8" />
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm md:text-base font-semibold text-inherit">{primaryLabel}</span>
                      <span
                        className={`text-sm font-light ${
                          isConfigured ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {isConfigured ? 'Conectado' : 'Desconectado'}
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
                <InvoiceScanControls
                  onScanned={() => setTableRefreshKey((prev) => prev + 1)}
                  onProgressUpdate={handleRealtimeProgressUpdate}
                />
                <div className="flex justify-end">
                  <InvoiceUploadDialog type="Gastos" onCreated={() => setTableRefreshKey((prev) => prev + 1)} />
                </div>
              </div>
              <ExpensesTable
                refreshKey={tableRefreshKey}
                processedInvoiceCount={invoiceCount}
                processedInvoiceCountReady={!cardsLoading}
                initialDateRange={dateRange}
                onDateRangeChange={handleDateRangeChange}
                onInvoiceTrashedOptimistic={handleInvoiceTrashedOptimistic}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GastosPage;
