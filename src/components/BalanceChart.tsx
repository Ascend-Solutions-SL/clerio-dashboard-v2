'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFinancialData } from '@/context/FinancialDataContext';

const getNiceCeil = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
};

const roundUpToThousand = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value / 1000) * 1000;
};

const BAR_WIDTH = 56;
const VISIBLE_MONTHS = 12;

const BalanceChart = () => {
  const [activeTab, setActiveTab] = useState<'Ingresos' | 'Gastos' | 'Total'>('Ingresos');
  const { data, loading, error, refresh } = useFinancialData();
  const chartData = useMemo(() => data?.monthlyData ?? [], [data]);
  const [viewportStart, setViewportStart] = useState(0);

  useEffect(() => {
    const maxStart = Math.max(0, chartData.length - VISIBLE_MONTHS);
    setViewportStart(maxStart);
  }, [chartData.length]);

  const visibleData = useMemo(() => {
    if (!chartData.length) return [];
    const safeStart = Math.min(Math.max(0, viewportStart), Math.max(0, chartData.length - VISIBLE_MONTHS));
    return chartData.slice(safeStart, safeStart + VISIBLE_MONTHS);
  }, [chartData, viewportStart]);

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
    const sliceLength = (visibleData.length ? visibleData : chartData.slice(-VISIBLE_MONTHS)).length;
    if (!sliceLength) return undefined;

    if (activeTab === 'Total') {
      const maxAbs = Math.max(Math.abs(chartExtents.minTotal), Math.abs(chartExtents.maxTotal));
      const nice = getNiceCeil(maxAbs);
      return nice ? [-nice, nice] : undefined;
    }

    const rounded = roundUpToThousand(chartExtents.maxIncomeExpense);
    return rounded ? [0, rounded] : undefined;
  }, [activeTab, chartData, chartExtents.maxIncomeExpense, chartExtents.maxTotal, chartExtents.minTotal, visibleData]);

  const activeDataKey = activeTab.toLowerCase();

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
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
      <div className="bg-white p-6 rounded-lg shadow-sm">
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
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Datos mensuales</h2>
          <p className="text-sm text-gray-500">Resumen de ingresos y gastos mensuales</p>
        </div>
      </div>
      <div className="flex gap-2 border-b mb-4 pb-2">
        {(['Ingresos', 'Gastos', 'Total'] as const).map((tab) => (
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
      <div>
        <div className="flex-1">
          <div style={{ width: '100%', height: 300 }}>
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
                  formatter={(value) => [
                    new Intl.NumberFormat('es-ES', { 
                      style: 'currency', 
                      currency: 'EUR' 
                    }).format(Number(value)),
                    activeTab
                  ]}
                  labelFormatter={(label, payload) => {
                    if (!payload || !payload.length) return label;
                    const month = payload[0]?.payload;
                    return month ? `${month.name} ${month.year}` : label;
                  }}
                />
                <Bar 
                  name={activeTab}
                  dataKey={activeDataKey}
                  fill={activeTab === 'Gastos' ? '#EF4444' : (activeTab === 'Ingresos' ? '#10B981' : '#3B82F6')} 
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {chartData.length > VISIBLE_MONTHS && (
            <div className="mt-3">
              <div className="flex justify-end text-xs text-gray-500 mb-1">
                <span>
                  {visibleData[0]?.name} {visibleData[0]?.year} → {visibleData[visibleData.length - 1]?.name}{' '}
                  {visibleData[visibleData.length - 1]?.year}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, chartData.length - VISIBLE_MONTHS)}
                value={viewportStart}
                onChange={(event) => setViewportStart(Number(event.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BalanceChart;