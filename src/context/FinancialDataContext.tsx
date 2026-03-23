"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

type FacturaAggregateRow = {
  fecha: string | null;
  importe_total: number | string | null;
};

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
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  minYear: number;
  maxYear: number;
}

const FinancialDataContext = createContext<FinancialDataContextValue | undefined>(undefined);

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const createYearTimeline = (year: number): MonthlyData[] =>
  Array.from({ length: 12 }).map((_, month) => ({
    year,
    month,
    name: monthNames[month],
    ingresos: 0,
    gastos: 0,
    total: 0,
  }));

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
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [minYear, setMinYear] = useState(currentYear);
  const [maxYear] = useState(currentYear);
  const [yearCache, setYearCache] = useState<Record<number, MonthlyData[]>>({});
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildYearData = useCallback((year: number, incomes: FacturaAggregateRow[], expenses: FacturaAggregateRow[]) => {
    const monthlyData = createYearTimeline(year);
    let totalIncome = 0;
    let totalExpenses = 0;

    incomes.forEach((item) => {
      if (!item.fecha) return;
      const amount = parseAmount(item.importe_total);
      totalIncome += amount;
      const month = new Date(item.fecha).getMonth();
      const row = monthlyData[month];
      row.ingresos += amount;
      row.total += amount;
    });

    expenses.forEach((item) => {
      if (!item.fecha) return;
      const amount = Math.abs(parseAmount(item.importe_total));
      totalExpenses += amount;
      const month = new Date(item.fecha).getMonth();
      const row = monthlyData[month];
      row.gastos += amount;
      row.total -= amount;
    });

    return {
      monthlyData,
      totalIncome,
      totalExpenses,
      incomeCount: incomes.length,
      expenseCount: expenses.length,
    };
  }, []);

  const fetchYear = useCallback(
    async (year: number, force = false) => {
      const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;
      if (empresaId == null) {
        setData(null);
        setLoading(false);
        return;
      }

      if (!force && yearCache[year]) {
        const cachedRows = yearCache[year];
        const totalIncome = cachedRows.reduce((acc, row) => acc + row.ingresos, 0);
        const totalExpenses = cachedRows.reduce((acc, row) => acc + row.gastos, 0);
        setData({
          totalIncome,
          incomeCount: 0,
          totalExpenses,
          expenseCount: 0,
          balance: totalIncome - totalExpenses,
          monthlyData: cachedRows,
        });
        setLoading(false);
        return;
      }

      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      try {
        setLoading(true);
        setError(null);

        const [incomeResult, expensesResult] = await Promise.all([
          supabase
            .from('facturas')
            .select('fecha, importe_total')
            .eq('empresa_id', empresaId)
            .eq('tipo', 'Ingresos')
            .gte('fecha', startDate)
            .lte('fecha', endDate),
          supabase
            .from('facturas')
            .select('fecha, importe_total')
            .eq('empresa_id', empresaId)
            .eq('tipo', 'Gastos')
            .gte('fecha', startDate)
            .lte('fecha', endDate),
        ]);

        if (incomeResult.error) throw incomeResult.error;
        if (expensesResult.error) throw expensesResult.error;

        const yearData = buildYearData(
          year,
          (incomeResult.data ?? []) as FacturaAggregateRow[],
          (expensesResult.data ?? []) as FacturaAggregateRow[]
        );

        setYearCache((prev) => ({ ...prev, [year]: yearData.monthlyData }));
        setData({
          totalIncome: yearData.totalIncome,
          incomeCount: yearData.incomeCount,
          totalExpenses: yearData.totalExpenses,
          expenseCount: yearData.expenseCount,
          balance: yearData.totalIncome - yearData.totalExpenses,
          monthlyData: yearData.monthlyData,
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
    [buildYearData, user?.empresaId, yearCache],
  );

  useEffect(() => {
    const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;
    if (empresaId == null) {
      setData(null);
      setYearCache({});
      setMinYear(currentYear);
      setSelectedYear(currentYear);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadBounds = async () => {
      setLoading(true);
      const { data: firstRows } = await supabase
        .from('facturas')
        .select('fecha')
        .eq('empresa_id', empresaId)
        .in('tipo', ['Ingresos', 'Gastos'])
        .order('fecha', { ascending: true })
        .limit(1);

      if (!isMounted) {
        return;
      }

      const firstDate = firstRows?.[0]?.fecha ? new Date(firstRows[0].fecha) : null;
      const nextMinYear = firstDate && !Number.isNaN(firstDate.getTime()) ? firstDate.getFullYear() : currentYear;
      setMinYear(nextMinYear);
      setSelectedYear((prev) => {
        if (prev < nextMinYear) return nextMinYear;
        if (prev > currentYear) return currentYear;
        return prev;
      });
      setLoading(false);
    };

    void loadBounds();

    return () => {
      isMounted = false;
    };
  }, [currentYear, user?.empresaId]);

  useEffect(() => {
    void fetchYear(selectedYear);
  }, [fetchYear, selectedYear]);

  const refresh = useCallback(async () => {
    await fetchYear(selectedYear, true);
  }, [fetchYear, selectedYear]);

  const value = useMemo<FinancialDataContextValue>(
    () => ({
      data,
      loading,
      error,
      refresh,
      selectedYear,
      setSelectedYear,
      minYear,
      maxYear,
    }),
    [data, error, loading, maxYear, minYear, refresh, selectedYear],
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
