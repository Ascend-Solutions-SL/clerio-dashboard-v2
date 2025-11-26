"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useDashboardSession } from '@/context/dashboard-session-context';

interface MonthlyData {
  year: number;
  month: number;
  name: string;
  ingresos: number;
  gastos: number;
  total: number;
}

interface FinancialData {
  totalIncome: number;
  incomeCount: number;
  totalExpenses: number;
  expenseCount: number;
  balance: number;
  monthlyData: MonthlyData[];
}

interface FinancialDataContextValue {
  data: FinancialData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const FinancialDataContext = createContext<FinancialDataContextValue | undefined>(undefined);

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const createMonthlyTimeline = (start: Date, end: Date): MonthlyData[] => {
  const months: MonthlyData[] = [];
  const cursor = new Date(start);
  cursor.setDate(1);
  const endCursor = new Date(end);
  endCursor.setDate(1);

  while (cursor <= endCursor) {
    months.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
      name: monthNames[cursor.getMonth()],
      ingresos: 0,
      gastos: 0,
      total: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

const getDefaultTimeline = (monthsBack = 12): MonthlyData[] => {
  const end = new Date();
  end.setDate(1);
  const start = new Date(end);
  start.setMonth(start.getMonth() - (monthsBack - 1));
  return createMonthlyTimeline(start, end);
};

const parseAmount = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  const numeric = `${value}`
    .replace(/[\s€]/g, '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/\.(?=.*\.)/g, '')
    .replace(',', '.');

  const parsed = Number.parseFloat(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const FinancialDataProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useDashboardSession();
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useMemo(
    () =>
      async () => {
        if (!user) {
          setData(null);
          setLoading(false);
          return;
        }

        if (!user.empresaId) {
          setData(null);
          setError('No se encontró una empresa asociada a la sesión.');
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError(null);

          const empresaId = user.empresaId;

          const [incomeResult, expensesResult] = await Promise.all([
            supabase
              .from('facturas')
              .select('fecha, importe_total')
              .eq('empresa_id', empresaId)
              .eq('tipo', 'Ingresos')
              .order('fecha', { ascending: true }),
            supabase
              .from('facturas')
              .select('fecha, importe_total')
              .eq('empresa_id', empresaId)
              .eq('tipo', 'Gastos')
              .order('fecha', { ascending: true }),
          ]);

          if (incomeResult.error) throw incomeResult.error;
          if (expensesResult.error) throw expensesResult.error;

          const allDates = [
            ...(incomeResult.data ?? []).map((item) => (item.fecha ? new Date(item.fecha) : null)),
            ...(expensesResult.data ?? []).map((item) => (item.fecha ? new Date(item.fecha) : null)),
          ].filter((d): d is Date => Boolean(d));

          const monthlyData = (() => {
            if (!allDates.length) {
              return getDefaultTimeline();
            }

            const minDate = new Date(
              Math.min.apply(
                null,
                allDates.map((d) => d.getTime()),
              ),
            );
            const maxDate = new Date(
              Math.max.apply(
                null,
                allDates.map((d) => d.getTime()),
              ),
            );
            const currentMonth = new Date();
            currentMonth.setDate(1);
            if (maxDate < currentMonth) {
              maxDate.setTime(currentMonth.getTime());
            }

            return createMonthlyTimeline(minDate, maxDate);
          })();
          let totalIncome = 0;
          let totalExpenses = 0;
          const incomeCount = incomeResult.data?.length ?? 0;
          const expenseCount = expensesResult.data?.length ?? 0;

          incomeResult.data?.forEach((item) => {
            if (!item.fecha) return;
            const amount = parseAmount(item.importe_total);
            totalIncome += amount;

            const d = new Date(item.fecha);
            const match = monthlyData.find(
              (m) => m.month === d.getMonth() && m.year === d.getFullYear(),
            );
            if (!match) {
              const extraTimeline = createMonthlyTimeline(d, d);
              monthlyData.push(...extraTimeline);
            }
            if (match) {
              match.ingresos += amount;
              match.total += amount;
            }
          });

          expensesResult.data?.forEach((item) => {
            if (!item.fecha) return;
            const amount = Math.abs(parseAmount(item.importe_total));
            totalExpenses += amount;

            const d = new Date(item.fecha);
            const match = monthlyData.find(
              (m) => m.month === d.getMonth() && m.year === d.getFullYear(),
            );
            if (!match) {
              const extraTimeline = createMonthlyTimeline(d, d);
              monthlyData.push(...extraTimeline);
            }
            if (match) {
              match.gastos += amount;
              match.total -= amount;
            }
          });

          monthlyData.sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));

          setData({
            totalIncome,
            incomeCount,
            totalExpenses,
            expenseCount,
            balance: totalIncome - totalExpenses,
            monthlyData,
          });
        } catch (err) {
          const message = (() => {
            if (err instanceof Error) return err.message;
            if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
              return err.message;
            }
            try {
              return JSON.stringify(err);
            } catch {
              return String(err);
            }
          })();

          console.error('Error fetching financial data', message, err);
          setError(
            message
              ? `No se pudieron cargar los datos financieros: ${message}`
              : 'No se pudieron cargar los datos financieros. Inténtalo de nuevo más tarde.',
          );
        } finally {
          setLoading(false);
        }
      },
    [user],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const value = useMemo<FinancialDataContextValue>(
    () => ({
      data,
      loading,
      error,
      refresh: fetchData,
    }),
    [data, error, fetchData, loading],
  );

  return <FinancialDataContext.Provider value={value}>{children}</FinancialDataContext.Provider>;
};

export const useFinancialData = () => {
  const context = useContext(FinancialDataContext);
  if (!context) {
    throw new Error('useFinancialData debe usarse dentro de FinancialDataProvider');
  }

  return context;
};
