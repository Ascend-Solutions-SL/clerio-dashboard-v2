'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFinancialData } from '@/context/FinancialDataContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const getNiceCeil = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
};

const roundUpAxisMax = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;

  if (value <= 100) return 100;
  if (value <= 1000) return Math.ceil(value / 100) * 100;
  return Math.ceil(value / 1000) * 1000;
};

const VISIBLE_MONTHS = 12;

const BalanceChart = () => {
  const [activeTab, setActiveTab] = useState<'Ingresos' | 'Gastos' | 'Neto' | 'Combinado'>('Ingresos');
  const { data, loading, error, refresh } = useFinancialData();
  const chartData = useMemo(() => data?.monthlyData ?? [], [data]);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [renderYear, setRenderYear] = useState<number>(currentYear);
  const [slideState, setSlideState] = useState<'idle' | 'out' | 'in'>('idle');
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');

  const yearBounds = useMemo(() => {
    if (!chartData.length) {
      return { minYear: currentYear, maxYear: currentYear };
    }

    let minYear = chartData[0].year;
    let maxYear = chartData[0].year;
    chartData.forEach((row) => {
      minYear = Math.min(minYear, row.year);
      maxYear = Math.max(maxYear, row.year);
    });

    return { minYear, maxYear: currentYear };
  }, [chartData, currentYear]);

  const defaultYear = useMemo(() => {
    if (!chartData.length) return currentYear;

    let lastYearWithData: number | null = null;
    chartData.forEach((row) => {
      if ((row.ingresos ?? 0) !== 0 || (row.gastos ?? 0) !== 0) {
        if (lastYearWithData == null || row.year > lastYearWithData) {
          lastYearWithData = row.year;
        }
      }
    });

    const candidate = lastYearWithData ?? currentYear;
    return Math.min(candidate, currentYear);
  }, [chartData, currentYear]);

  useEffect(() => {
    setSelectedYear(defaultYear);
  }, [defaultYear]);

  useEffect(() => {
    setRenderYear((prev) => {
      if (prev === selectedYear) return prev;
      return prev;
    });

    if (renderYear === selectedYear) {
      return;
    }

    setSlideDir(selectedYear < renderYear ? 'left' : 'right');
    setSlideState('out');

    const outTimer = window.setTimeout(() => {
      setRenderYear(selectedYear);
      setSlideState('in');
    }, 150);

    const inTimer = window.setTimeout(() => {
      setSlideState('idle');
    }, 300);

    return () => {
      window.clearTimeout(outTimer);
      window.clearTimeout(inTimer);
    };
  }, [renderYear, selectedYear]);

  const visibleData = useMemo(() => {
    if (!chartData.length) return [];
    const yearRows = chartData.filter((row) => row.year === renderYear);
    return yearRows.slice(0, VISIBLE_MONTHS);
  }, [chartData, renderYear]);

  const chartExtents = useMemo(() => {
    const slice = visibleData.length ? visibleData : chartData.slice(-VISIBLE_MONTHS);
    let maxIncomeExpense = 0;
    let minTotal = 0;
    let maxTotal = 0;

    slice.forEach(({ ingresos = 0, gastos = 0, total = 0 }) => {
      maxIncomeExpense = Math.max(maxIncomeExpense, ingresos, gastos);
      minTotal = Math.min(minTotal, total);
      maxTotal = Math.max(maxTotal, total);
    });

    return { maxIncomeExpense, minTotal, maxTotal };
  }, [chartData, visibleData]);

  const yAxisDomain = useMemo<[number, number] | undefined>(() => {
    const sliceLength = visibleData.length;
    if (!sliceLength) return undefined;

    if (activeTab === 'Neto') {
      const maxAbs = Math.max(Math.abs(chartExtents.minTotal), Math.abs(chartExtents.maxTotal));
      const nice = getNiceCeil(maxAbs);
      const resolved = nice || 0;
      const minAbs = Math.max(100, resolved);
      return [-minAbs, minAbs];
    }

    const rounded = roundUpAxisMax(chartExtents.maxIncomeExpense);
    return rounded ? [0, rounded] : undefined;
  }, [activeTab, chartExtents.maxIncomeExpense, chartExtents.maxTotal, chartExtents.minTotal, visibleData.length]);

  const activeDataKey = useMemo<'ingresos' | 'gastos' | 'total'>(() => {
    if (activeTab === 'Ingresos') return 'ingresos';
    if (activeTab === 'Gastos') return 'gastos';
    return 'total';
  }, [activeTab]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Balance actual</h2>
            <p className="text-sm text-gray-500">Cargando datos...</p>
          </div>
        </div>
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Cargando gráfico...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Error</h2>
            <p className="text-sm text-red-500">{error ?? 'No se pudieron cargar los datos financieros.'}</p>
          </div>
        </div>
        <div className="h-[300px] flex items-center justify-center">
          <button 
            onClick={() => refresh()}
            className="px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Datos mensuales</h2>
          <p className="text-sm text-gray-500">Resumen de ingresos y gastos mensuales</p>
        </div>
      </div>
      <div className="flex gap-2 border-b mb-4 pb-2">
        <div className="flex gap-2">
          {(['Ingresos', 'Gastos', 'Combinado', 'Neto'] as const).map((tab) => (
            <button
              key={tab}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 cursor-pointer select-none ${
                activeTab === tab
                  ? 'text-blue-600 bg-blue-50 shadow-md shadow-blue-500/20 border border-blue-200 -translate-y-0.5'
                  : 'text-gray-500 hover:text-blue-600 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md hover:shadow-blue-500/15 border border-transparent'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedYear((year) => Math.max(yearBounds.minYear, year - 1))}
            disabled={selectedYear <= yearBounds.minYear}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Año anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-xs font-semibold text-gray-600 tabular-nums min-w-[44px] text-center">
            {selectedYear}
          </div>
          <button
            type="button"
            onClick={() => setSelectedYear((year) => Math.min(yearBounds.maxYear, year + 1))}
            disabled={selectedYear >= yearBounds.maxYear}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Año siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div>
        <div className="flex-1">
          <div
            style={{ width: '100%', height: 300 }}
            className={`transition-all duration-300 ease-out ${
              slideState === 'idle'
                ? 'opacity-100 translate-x-0'
                : slideState === 'out'
                  ? slideDir === 'left'
                    ? 'opacity-0 -translate-x-4'
                    : 'opacity-0 translate-x-4'
                  : slideDir === 'left'
                    ? 'opacity-100 translate-x-4'
                    : 'opacity-100 -translate-x-4'
            }`}
          >
            <ResponsiveContainer>
              <BarChart 
                data={visibleData} 
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                barGap={0}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  width={60}
                  axisLine={false} 
                  tickLine={false} 
                  domain={yAxisDomain}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    }).format(Number(value))
                  }
                />
                <Tooltip
                  formatter={(value: unknown) =>
                    new Intl.NumberFormat('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(Number(value))
                  }
                />

                {activeTab === 'Combinado' ? (
                  <>
                    <Bar
                      name="Ingresos"
                      dataKey="ingresos"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                      barSize={12}
                    />
                    <Bar
                      name="Gastos"
                      dataKey="gastos"
                      fill="#EF4444"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                      barSize={12}
                    />
                  </>
                ) : (
                  <Bar
                    name={activeTab}
                    dataKey={activeDataKey}
                    fill={activeTab === 'Gastos' ? '#EF4444' : activeTab === 'Ingresos' ? '#10B981' : '#3B82F6'}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceChart;