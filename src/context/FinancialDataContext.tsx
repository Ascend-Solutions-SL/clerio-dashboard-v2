"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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
const ADJACENT_CACHE_DISTANCE = 1;

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
  const inFlightYearsRef = useRef<Record<number, Promise<MonthlyData[]> | undefined>>({});

  const pruneYearCache = useCallback(
    (cache: Record<number, MonthlyData[]>, centerYear: number) => {
      const allowedYears = new Set<number>();
      for (let year = centerYear - ADJACENT_CACHE_DISTANCE; year <= centerYear + ADJACENT_CACHE_DISTANCE; year += 1) {
        if (year >= minYear && year <= maxYear) {
          allowedYears.add(year);
        }
      }

      return Object.fromEntries(
        Object.entries(cache).filter(([year]) => allowedYears.has(Number(year)))
      ) as Record<number, MonthlyData[]>;
    },
    [maxYear, minYear],
  );

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

  const fetchMonthlyDataForYear = useCallback(
    async (empresaId: number, year: number): Promise<MonthlyData[]> => {
      const inFlight = inFlightYearsRef.current[year];
      if (inFlight) {
        return inFlight;
      }

      const request = (async () => {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

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
          (expensesResult.data ?? []) as FacturaAggregateRow[],
        );

        return yearData.monthlyData;
      })();

      inFlightYearsRef.current[year] = request;

      try {
        return await request;
      } finally {
        delete inFlightYearsRef.current[year];
      }
    },
    [buildYearData],
  );

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

      try {
        setLoading(true);
        setError(null);

        const yearRows = await fetchMonthlyDataForYear(empresaId, year);

        setYearCache((prev) => pruneYearCache({ ...prev, [year]: yearRows }, year));
        setData({
          totalIncome: yearRows.reduce((acc, row) => acc + row.ingresos, 0),
          incomeCount: 0,
          totalExpenses: yearRows.reduce((acc, row) => acc + row.gastos, 0),
          expenseCount: 0,
          balance: yearRows.reduce((acc, row) => acc + row.total, 0),
          monthlyData: yearRows,
        });

        const adjacentYears = [year - 1, year + 1].filter((candidate) => candidate >= minYear && candidate <= maxYear);
        void Promise.all(
          adjacentYears.map(async (adjacentYear) => {
            if (yearCache[adjacentYear]) {
              return;
            }

            try {
              const adjacentRows = await fetchMonthlyDataForYear(empresaId, adjacentYear);
              setYearCache((prev) => {
                if (prev[adjacentYear]) {
                  return pruneYearCache(prev, year);
                }

                return pruneYearCache({ ...prev, [adjacentYear]: adjacentRows }, year);
              });
            } catch {
              // ignore adjacent prefetch errors
            }
          }),
        );
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
    [fetchMonthlyDataForYear, maxYear, minYear, pruneYearCache, user?.empresaId, yearCache],
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
