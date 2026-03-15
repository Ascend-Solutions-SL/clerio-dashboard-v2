"use client";

import * as React from 'react';

import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import BalanceChart from '@/components/BalanceChart';
import Integrations from '@/components/Integrations';
import { FileText, ArrowUpCircle, ArrowDownCircle, CalendarDays, Filter, RotateCcw } from 'lucide-react';
import { useFinancialData } from '@/context/FinancialDataContext';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const parseISODate = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const monthTitleFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function DashboardHome() {
  const { data, loading } = useFinancialData();
  const { user, isLoading: isSessionLoading } = useDashboardSession();

  const [dateRange, setDateRange] = React.useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });
  const [cardsLoading, setCardsLoading] = React.useState(false);
  const [cardsTotals, setCardsTotals] = React.useState<{
    totalIncome: number;
    incomeCount: number;
    totalExpenses: number;
    expenseCount: number;
  } | null>(null);

  const hasPartialDateFilter =
    (dateRange.startDate && !dateRange.endDate) || (!dateRange.startDate && dateRange.endDate);
  const hasDateFilter = Boolean(dateRange.startDate && dateRange.endDate);
  const [isDateFilterOpen, setIsDateFilterOpen] = React.useState(false);
  const [isStartCalendarOpen, setIsStartCalendarOpen] = React.useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = React.useState(false);
  const [startMonthView, setStartMonthView] = React.useState<Date>(() => parseISODate(dateRange.startDate) ?? new Date());
  const [endMonthView, setEndMonthView] = React.useState<Date>(() => parseISODate(dateRange.endDate) ?? new Date());

  React.useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    const businessName = user?.businessName?.trim() || '';
    const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;
    if (!businessName && empresaId == null) {
      setCardsTotals(null);
      return;
    }

    if (hasPartialDateFilter) {
      setCardsTotals(null);
      return;
    }

    let isMounted = true;
    const load = async () => {
      setCardsLoading(true);
      try {
        const makeQuery = (tipo: 'Ingresos' | 'Gastos') => {
          let q = supabase
            .from('facturas')
            .select('importe_total', { count: 'exact' })
            .eq('tipo', tipo)
            .eq('source', 'ocr');

          if (empresaId != null && businessName) {
            q = q.or(`empresa_id.eq.${empresaId},user_businessname.eq.${businessName}`);
          } else {
            q = empresaId != null ? q.eq('empresa_id', empresaId) : q.eq('user_businessname', businessName);
          }

          if (hasDateFilter) {
            q = q.gte('fecha', dateRange.startDate).lte('fecha', dateRange.endDate);
          }
          return q;
        };

        const [incomeRes, expensesRes] = await Promise.all([makeQuery('Ingresos'), makeQuery('Gastos')]);
        if (!isMounted) {
          return;
        }

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

        const incomeRows = (incomeRes.data ?? []) as { importe_total: unknown }[];
        const expenseRows = (expensesRes.data ?? []) as { importe_total: unknown }[];

        const totalIncome = incomeRows.reduce((acc, r) => acc + parseAmount(r.importe_total), 0);
        const totalExpenses = expenseRows.reduce((acc, r) => acc + Math.abs(parseAmount(r.importe_total)), 0);

        setCardsTotals({
          totalIncome,
          incomeCount: incomeRes.count ?? incomeRows.length,
          totalExpenses,
          expenseCount: expensesRes.count ?? expenseRows.length,
        });
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
  }, [dateRange.endDate, dateRange.startDate, hasDateFilter, hasPartialDateFilter, isSessionLoading, user?.businessName, user?.empresaId]);

  const sourceTotals = cardsTotals ?? data;

  const totalInvoices = sourceTotals ? sourceTotals.incomeCount + sourceTotals.expenseCount : 0;
  const totalIncome = sourceTotals?.totalIncome ?? 0;
  const totalExpenses = sourceTotals?.totalExpenses ?? 0;

  const formatCurrency = (value: number) =>
    value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getCalendarDays = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const leading = (first.getDay() + 6) % 7;
    const daysInMonth = last.getDate();
    const cells: Date[] = [];

    for (let i = leading; i > 0; i -= 1) {
      cells.push(new Date(year, month, 1 - i));
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }
    while (cells.length % 7 !== 0) {
      cells.push(new Date(year, month + 1, cells.length - (leading + daysInMonth) + 1));
    }
    return cells;
  };

  const handleStartDateInputChange = (value: string) => {
    setDateRange((prev) => ({ ...prev, startDate: value }));
    const parsed = parseISODate(value);
    if (parsed) {
      setStartMonthView(parsed);
    }
  };

  const handleEndDateInputChange = (value: string) => {
    setDateRange((prev) => ({ ...prev, endDate: value }));
    const parsed = parseISODate(value);
    if (parsed) {
      setEndMonthView(parsed);
    }
  };

  const setQuickDateRange = (daysBack: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - daysBack);
    setDateRange({ startDate: toISODate(start), endDate: toISODate(end) });
    setStartMonthView(start);
    setEndMonthView(end);
  };

  const setThisMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateRange({ startDate: toISODate(start), endDate: toISODate(end) });
    setStartMonthView(start);
    setEndMonthView(end);
  };

  const setThisQuarterRange = () => {
    const now = new Date();
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), quarterStartMonth, 1);
    const end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
    setDateRange({ startDate: toISODate(start), endDate: toISODate(end) });
    setStartMonthView(start);
    setEndMonthView(end);
  };

  const setThisYearRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    setDateRange({ startDate: toISODate(start), endDate: toISODate(end) });
    setStartMonthView(start);
    setEndMonthView(end);
  };

  const resetDateFilter = () => {
    const now = new Date();
    setDateRange({ startDate: '', endDate: '' });
    setStartMonthView(now);
    setEndMonthView(now);
  };

  const renderCalendar = (
    monthView: Date,
    setMonthView: React.Dispatch<React.SetStateAction<Date>>,
    selectedValue: string,
    onSelect: (isoDate: string) => void,
    onClose: () => void
  ) => {
    const selectedISO = selectedValue || '';
    const monthDays = getCalendarDays(monthView);
    const activeMonth = monthView.getMonth();

    return (
      <div className="w-[258px] rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-[0_14px_36px_rgba(15,23,42,0.16)] backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonthView((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <span className="text-[12px] font-semibold capitalize tracking-tight text-slate-800">
            {monthTitleFormatter.format(monthView)}
          </span>
          <button
            type="button"
            onClick={() => setMonthView((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-slate-500">
          {weekDays.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {monthDays.map((dayDate) => {
            const iso = toISODate(dayDate);
            const isSelected = selectedISO === iso;
            const isCurrentMonth = dayDate.getMonth() === activeMonth;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  onSelect(iso);
                  onClose();
                }}
                className={cn(
                  'h-8 rounded-lg text-[11px] transition-colors',
                  isSelected
                    ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)]'
                    : isCurrentMonth
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-slate-50'
                )}
              >
                {dayDate.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="-m-8">
      <div className="bg-white pt-4 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <Header />
          <div className="flex flex-col gap-3 max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Popover open={isDateFilterOpen} onOpenChange={setIsDateFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                    <Filter className="mr-1.5 h-3.5 w-3.5" />
                    Fecha
                    {hasDateFilter ? (
                      <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white">
                        1
                      </span>
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[340px] p-2.5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
                  side="bottom"
                  sideOffset={8}
                  align="end"
                >
                  <div className="space-y-2">
                    <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/85 p-1.5 space-y-1.5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
                      <div className="flex items-center justify-between">
                        <label className="pl-1 text-xs font-semibold text-slate-800">Fecha</label>
                        <button
                          type="button"
                          onClick={resetDateFilter}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                          Por Defecto
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="relative">
                          <CalendarDays className="pointer-events-none absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <Input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(event) => handleStartDateInputChange(event.target.value)}
                            className="h-7 rounded-lg border-slate-200/80 bg-white pl-7 pr-8 text-[11px] shadow-sm [font-size:11px] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:pointer-events-none [&::-webkit-datetime-edit]:text-[11px]"
                          />
                          <Popover open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="absolute right-1 top-1/2 z-10 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Abrir calendario de fecha inicio"
                              >
                                <CalendarDays className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto border-none bg-transparent p-0 shadow-none" align="start" sideOffset={6}>
                              {renderCalendar(
                                startMonthView,
                                setStartMonthView,
                                dateRange.startDate,
                                (value) => handleStartDateInputChange(value),
                                () => setIsStartCalendarOpen(false)
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="relative">
                          <CalendarDays className="pointer-events-none absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <Input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(event) => handleEndDateInputChange(event.target.value)}
                            className="h-7 rounded-lg border-slate-200/80 bg-white pl-7 pr-8 text-[11px] shadow-sm [font-size:11px] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:pointer-events-none [&::-webkit-datetime-edit]:text-[11px]"
                          />
                          <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="absolute right-1 top-1/2 z-10 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Abrir calendario de fecha fin"
                              >
                                <CalendarDays className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto border-none bg-transparent p-0 shadow-none" align="start" sideOffset={6}>
                              {renderCalendar(
                                endMonthView,
                                setEndMonthView,
                                dateRange.endDate,
                                (value) => handleEndDateInputChange(value),
                                () => setIsEndCalendarOpen(false)
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      <div className="flex flex-nowrap gap-1">
                        <button
                          type="button"
                          onClick={() => setQuickDateRange(30)}
                          className="whitespace-nowrap rounded-full border border-slate-200/90 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 shadow-sm hover:bg-slate-100"
                        >
                          Últimos 30 días
                        </button>
                        <button
                          type="button"
                          onClick={setThisMonthRange}
                          className="whitespace-nowrap rounded-full border border-slate-200/90 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 shadow-sm hover:bg-slate-100"
                        >
                          Este mes
                        </button>
                        <button
                          type="button"
                          onClick={setThisQuarterRange}
                          className="whitespace-nowrap rounded-full border border-slate-200/90 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 shadow-sm hover:bg-slate-100"
                        >
                          Este trimestre
                        </button>
                        <button
                          type="button"
                          onClick={setThisYearRange}
                          className="whitespace-nowrap rounded-full border border-slate-200/90 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 shadow-sm hover:bg-slate-100"
                        >
                          Este año
                        </button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col md:flex-row md:justify-between gap-4 md:gap-6">
            <StatCard
              title="Facturas Procesadas"
              value={loading || cardsLoading ? '—' : totalInvoices.toString()}
              percentage={22}
              Icon={FileText}
              size="compact"
              className="md:w-[300px]"
            />
            <StatCard
              title="Ingresos"
              value={loading || cardsLoading ? '—' : `${formatCurrency(totalIncome)}€`}
              percentage={41}
              Icon={ArrowUpCircle}
              size="compact"
              className="md:w-[300px]"
              href="/dashboard/ingresos"
            />
            <StatCard
              title="Gastos"
              value={loading || cardsLoading ? '—' : `${formatCurrency(totalExpenses)}€`}
              percentage={-16}
              Icon={ArrowDownCircle}
              size="compact"
              className="md:w-[300px]"
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
