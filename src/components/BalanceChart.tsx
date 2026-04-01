'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFinancialData } from '@/context/FinancialDataContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const getNiceStep = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const multipliers = [1, 1.5, 2, 2.5, 5, 10];
  const multiplier = multipliers.find((m) => normalized <= m) ?? 10;

  return multiplier * magnitude;
};

const VISIBLE_MONTHS = 12;
const CHART_HEIGHT = 300;
const YEAR_TRANSITION_DURATION_MS = 220;

const BalanceChart = () => {
  const [activeTab, setActiveTab] = useState<'Ingresos' | 'Gastos' | 'Neto' | 'Combinado'>('Ingresos');
  const { data, loading, error, refresh, selectedYear, setSelectedYear, minYear, maxYear } = useFinancialData();
  const chartData = useMemo(() => data?.monthlyData ?? [], [data]);
  const [renderedData, setRenderedData] = useState<typeof chartData>(chartData);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const renderedYearRef = useRef<number | null>(chartData[0]?.year ?? null);
  const transitionTimeoutRef = useRef<number | null>(null);

  const yearBounds = useMemo(() => ({ minYear, maxYear }), [maxYear, minYear]);

  useEffect(() => {
    if (!chartData.length) {
      return;
    }

    const incomingYear = chartData[0]?.year;
    if (!incomingYear || incomingYear !== selectedYear) {
      return;
    }

    const renderedYear = renderedYearRef.current;
    if (renderedYear == null) {
      renderedYearRef.current = incomingYear;
      setRenderedData(chartData);
      return;
    }

    if (incomingYear === renderedYear) {
      setRenderedData(chartData);
      return;
    }

    if (transitionTimeoutRef.current != null) {
      window.clearTimeout(transitionTimeoutRef.current);
    }

    setIsTransitioning(true);

    transitionTimeoutRef.current = window.setTimeout(() => {
      renderedYearRef.current = incomingYear;
      setRenderedData(chartData);
      setIsTransitioning(false);
      transitionTimeoutRef.current = null;
    }, YEAR_TRANSITION_DURATION_MS);
  }, [chartData, selectedYear]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current != null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const visibleData = useMemo(() => {
    if (!renderedData.length) return [];
    return renderedData.slice(0, VISIBLE_MONTHS);
  }, [renderedData]);

  const getYAxisConfigForRows = (rows: typeof visibleData): { domain?: [number, number]; ticks?: number[] } => {
    const slice = rows.length ? rows : chartData.slice(-VISIBLE_MONTHS);
    let maxIncome = 0;
    let maxExpenses = 0;
    let minTotal = 0;
    let maxTotal = 0;

    slice.forEach(({ ingresos = 0, gastos = 0, total = 0 }) => {
      maxIncome = Math.max(maxIncome, ingresos);
      maxExpenses = Math.max(maxExpenses, gastos);
      minTotal = Math.min(minTotal, total);
      maxTotal = Math.max(maxTotal, total);
    });

    const sliceLength = rows.length;
    if (!sliceLength) return {};

    const targetIntervals = 3;
    const maxCombined = Math.max(maxIncome, maxExpenses);

    if (activeTab === 'Neto') {
      const maxAbs = Math.max(Math.abs(minTotal), Math.abs(maxTotal));
      const step = getNiceStep((maxAbs || 1) / targetIntervals);
      const maxAxis = Math.max(step, Math.ceil((maxAbs || step) / step) * step);
      const ticks = Array.from({ length: targetIntervals * 2 + 1 }, (_, idx) => -maxAxis + idx * step);
      return { domain: [-maxAxis, maxAxis], ticks };
    }

    const maxValue =
      activeTab === 'Ingresos'
        ? maxIncome
        : activeTab === 'Gastos'
          ? maxExpenses
          : maxCombined;
    const step = getNiceStep((maxValue || 1) / targetIntervals);
    const maxAxis = Math.max(step, Math.ceil((maxValue || step) / step) * step);
    const ticks = Array.from({ length: Math.round(maxAxis / step) + 1 }, (_, idx) => idx * step);

    return { domain: [0, maxAxis], ticks };
  };

  const activeDataKey = useMemo<'ingresos' | 'gastos' | 'total'>(() => {
    if (activeTab === 'Ingresos') return 'ingresos';
    if (activeTab === 'Gastos') return 'gastos';
    return 'total';
  }, [activeTab]);

  const hasInvoicesForRows = (rows: typeof visibleData) => {
    if (!rows.length) {
      return false;
    }

    if (activeTab === 'Ingresos') {
      return rows.some((row) => (row.ingresos ?? 0) > 0);
    }

    if (activeTab === 'Gastos') {
      return rows.some((row) => (row.gastos ?? 0) > 0);
    }

    return rows.some((row) => (row.ingresos ?? 0) > 0 || (row.gastos ?? 0) > 0);
  };

  const hasInvoicesForSelection = useMemo(() => hasInvoicesForRows(visibleData), [activeTab, visibleData]);

  const renderChartBars = (rows: typeof visibleData) => {
    const yAxisConfig = getYAxisConfigForRows(rows);

    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={rows} margin={{ top: 5, right: 20, left: 20, bottom: 5 }} barGap={0}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
          <YAxis
            width={60}
            axisLine={false}
            tickLine={false}
            domain={yAxisConfig.domain}
            ticks={yAxisConfig.ticks}
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
    );
  };

  const isRenderYearDataReady = visibleData.length > 0;

  const hasRenderableData = Boolean(data?.monthlyData);
  const isChartLoadingState = !hasRenderableData && (loading || (!data && !error));

  if (isChartLoadingState) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Datos mensuales</h2>
            <p className="text-sm text-gray-500">Actualizando información...</p>
          </div>
        </div>
        <div className="h-[300px] flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
            Cargando gráfico...
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Datos mensuales</h2>
            <p className="text-sm text-slate-500">No hemos podido actualizar el gráfico por ahora.</p>
          </div>
        </div>
        <div className="h-[300px] flex items-center justify-center">
          <button 
            onClick={() => refresh()}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
            onClick={() => setSelectedYear(Math.max(yearBounds.minYear, selectedYear - 1))}
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
            onClick={() => setSelectedYear(Math.min(yearBounds.maxYear, selectedYear + 1))}
            disabled={selectedYear >= yearBounds.maxYear}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Año siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div>
        <div className="flex-1 min-w-0">
          <div style={{ width: '100%', height: 300, minWidth: 0, minHeight: 300 }}>
            {!isRenderYearDataReady ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
                  Cargando gráfico...
                </div>
              </div>
            ) : (
              <div
                className={`h-[300px] transition-opacity ease-out ${isTransitioning ? 'opacity-60' : 'opacity-100'}`}
                style={{ transitionDuration: `${YEAR_TRANSITION_DURATION_MS}ms` }}
              >
                {hasInvoicesForSelection ? (
                  renderChartBars(visibleData)
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-center">
                    <p className="max-w-[360px] text-sm text-slate-500">
                      No hay facturas registradas para el periodo seleccionado.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceChart;