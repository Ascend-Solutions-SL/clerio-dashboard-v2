"use client";

import * as React from 'react';

import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import BalanceChart from '@/components/BalanceChart';
import Integrations from '@/components/Integrations';
import { FileText, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useFinancialData } from '@/context/FinancialDataContext';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';
import { DateRangeSelector, type DateRangeValue } from '@/components/ui/date-range-selector';
import {
  getInitialSharedDashboardDateRange,
  getSharedDashboardDateRangeFromStorage,
  setSharedDashboardDateRange,
} from '@/lib/dashboard-date-range';

type DashboardCardsTotals = {
  totalIncome: number;
  incomeCount: number;
  totalExpenses: number;
  expenseCount: number;
};

const dashboardCardsCache = new Map<string, DashboardCardsTotals>();

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

const sameCardsTotals = (a: DashboardCardsTotals | null, b: DashboardCardsTotals) =>
  Boolean(
    a &&
      a.totalIncome === b.totalIncome &&
      a.incomeCount === b.incomeCount &&
      a.totalExpenses === b.totalExpenses &&
      a.expenseCount === b.expenseCount
  );

export default function DashboardHome() {
  const { loading } = useFinancialData();
  const { user, isLoading: isSessionLoading } = useDashboardSession();
  const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;

  const [dateRange, setDateRange] = React.useState<DateRangeValue>(getInitialSharedDashboardDateRange);
  const [cardsLoading, setCardsLoading] = React.useState(false);
  const [cardsTotals, setCardsTotals] = React.useState<DashboardCardsTotals | null>(null);

  const hasPartialDateFilter =
    (dateRange.startDate && !dateRange.endDate) || (!dateRange.startDate && dateRange.endDate);
  const hasDateFilter = Boolean(dateRange.startDate && dateRange.endDate);
  const cardsCacheKey = `${empresaId ?? 'none'}|${dateRange.startDate || 'no-start'}|${dateRange.endDate || 'no-end'}`;

  const handleDateRangeChange = React.useCallback((next: DateRangeValue) => {
    setDateRange((prev) => {
      if (prev.startDate === next.startDate && prev.endDate === next.endDate) {
        return prev;
      }

      setSharedDashboardDateRange(next);
      return next;
    });
  }, []);

  React.useEffect(() => {
    const storedRange = getSharedDashboardDateRangeFromStorage();
    setDateRange((prev) =>
      prev.startDate === storedRange.startDate && prev.endDate === storedRange.endDate ? prev : storedRange
    );
  }, []);

  React.useEffect(() => {
    const cached = dashboardCardsCache.get(cardsCacheKey);
    if (cached) {
      setCardsTotals(cached);
      setCardsLoading(false);
    }
  }, [cardsCacheKey]);

  React.useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    if (empresaId == null) {
      setCardsTotals(null);
      return;
    }

    if (hasPartialDateFilter) {
      setCardsTotals(null);
      return;
    }

    let isMounted = true;
    const load = async () => {
      const cached = dashboardCardsCache.get(cardsCacheKey);
      if (!cached) {
        setCardsLoading(true);
      }

      try {
        const makeCountQuery = (tipo: 'Ingresos' | 'Gastos') => {
          let q = supabase
            .from('facturas')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('tipo', tipo)
            .eq('is_trashed', false);
          if (hasDateFilter) {
            q = q.gte('fecha', dateRange.startDate).lte('fecha', dateRange.endDate);
          }
          return q;
        };

        const [incomeCountRes, expensesCountRes] = await Promise.all([
          makeCountQuery('Ingresos'),
          makeCountQuery('Gastos'),
        ]);
        if (!isMounted) {
          return;
        }

        const fallbackSumByChunks = async (tipo: 'Ingresos' | 'Gastos') => {
          let countQuery = supabase
            .from('facturas')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('tipo', tipo)
            .eq('is_trashed', false);

          if (hasDateFilter) {
            countQuery = countQuery.gte('fecha', dateRange.startDate).lte('fecha', dateRange.endDate);
          }

          const { count: expectedRows } = await countQuery;
          if (!expectedRows) {
            return 0;
          }

          let total = 0;
          let from = 0;
          const chunk = 1000;

          while (from < expectedRows) {
            let q = supabase
              .from('facturas')
              .select('importe_total')
              .eq('empresa_id', empresaId)
              .eq('tipo', tipo)
              .eq('is_trashed', false)
              .range(from, from + chunk - 1);

            if (hasDateFilter) {
              q = q.gte('fecha', dateRange.startDate).lte('fecha', dateRange.endDate);
            }

            const { data: rows, error } = await q;
            if (error || !rows) {
              break;
            }

            total += (rows as Array<{ importe_total: unknown }>).reduce((acc, row) => {
              const amount = parseAmount(row.importe_total);
              return acc + (tipo === 'Gastos' ? Math.abs(amount) : amount);
            }, 0);

            if (rows.length === 0) {
              break;
            }
            from += chunk;
          }

          return total;
        };

        const [totalIncome, totalExpenses] = await Promise.all([
          fallbackSumByChunks('Ingresos'),
          fallbackSumByChunks('Gastos'),
        ]);

        const incomeCount = incomeCountRes.count ?? 0;
        const expenseCount = expensesCountRes.count ?? 0;

        const nextTotals: DashboardCardsTotals = {
          totalIncome,
          incomeCount,
          totalExpenses,
          expenseCount,
        };

        dashboardCardsCache.set(cardsCacheKey, nextTotals);
        setCardsTotals((prev) => (sameCardsTotals(prev, nextTotals) ? prev : nextTotals));
      } finally {
        if (isMounted) {
          setCardsLoading(false);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [cardsCacheKey, dateRange.endDate, dateRange.startDate, empresaId, hasDateFilter, hasPartialDateFilter, isSessionLoading]);

  const shouldShowCardsPlaceholder = !cardsTotals && (loading || cardsLoading);

  const totalInvoices = cardsTotals ? cardsTotals.incomeCount + cardsTotals.expenseCount : 0;
  const totalIncome = cardsTotals?.totalIncome ?? 0;
  const totalExpenses = cardsTotals?.totalExpenses ?? 0;

  const formatCurrency = (value: number) =>
    value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="-m-8">
      <div className="bg-white pt-4 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <Header />
          <div className="flex flex-col gap-3 max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} className="h-8 min-w-[250px] text-xs" />
            </div>

            <div className="flex flex-col md:flex-row md:justify-between gap-4 md:gap-6">
            <StatCard
              title="Facturas"
              value={shouldShowCardsPlaceholder ? '—' : totalInvoices.toString()}
              Icon={FileText}
              size="compact"
              className="md:w-[260px]"
            />
            <StatCard
              title="Ingresos"
              value={shouldShowCardsPlaceholder ? '—' : `${formatCurrency(totalIncome)}€`}
              Icon={ArrowUpCircle}
              size="compact"
              className="md:w-[260px]"
              href="/dashboard/ingresos"
            />
            <StatCard
              title="Gastos"
              value={shouldShowCardsPlaceholder ? '—' : `${formatCurrency(totalExpenses)}€`}
              Icon={ArrowDownCircle}
              size="compact"
              className="md:w-[260px]"
              href="/dashboard/gastos"
            />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 pb-8 pt-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <BalanceChart />
            </div>
            <div>
              <Integrations />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
