'use client';

import * as React from 'react';
import { CalendarDays, ChevronDown, Filter, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface TableFiltersProps {
  filters: TableFiltersValue;
  onFiltersChange: (next: TableFiltersValue) => void;
  clients: string[];
  amountBounds: {
    min: number;
    max: number;
  };
  className?: string;
  clientLabel?: string;
}

export type TableFiltersValue = {
  startDate: string;
  endDate: string;
  clients: string[];
  minAmount: number | null;
  maxAmount: number | null;
};

const formatAmount = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));

const countActiveFilters = (filters: TableFiltersValue) => {
  let count = 0;
  if (filters.startDate && filters.endDate) count += 1;
  if (filters.clients.length > 0) count += 1;
  if (filters.minAmount != null && filters.maxAmount != null) count += 1;
  return count;
};

const normalizeClientLabel = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-/])([a-záéíóúüñ])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);

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

export function TableFilters({
  filters,
  onFiltersChange,
  clients,
  amountBounds,
  className,
  clientLabel = 'Cliente',
}: TableFiltersProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [draftStartDate, setDraftStartDate] = React.useState(filters.startDate);
  const [draftEndDate, setDraftEndDate] = React.useState(filters.endDate);
  const [draftClients, setDraftClients] = React.useState<string[]>(filters.clients);
  const [draftMinAmount, setDraftMinAmount] = React.useState<number>(filters.minAmount ?? amountBounds.min);
  const [draftMaxAmount, setDraftMaxAmount] = React.useState<number>(filters.maxAmount ?? amountBounds.max);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = React.useState(false);
  const [showClientScrollHint, setShowClientScrollHint] = React.useState(false);
  const [isStartCalendarOpen, setIsStartCalendarOpen] = React.useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = React.useState(false);
  const [startMonthView, setStartMonthView] = React.useState<Date>(() => parseISODate(filters.startDate) ?? new Date());
  const [endMonthView, setEndMonthView] = React.useState<Date>(() => parseISODate(filters.endDate) ?? new Date());
  const clientsScrollRef = React.useRef<HTMLDivElement | null>(null);
  const clientDropdownRef = React.useRef<HTMLDivElement | null>(null);

  const normalizedClients = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients) {
      const normalized = normalizeClientLabel(client);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (!map.has(key)) {
        map.set(key, normalized);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [clients]);

  React.useEffect(() => {
    if (!isOpen) {
      setDraftStartDate(filters.startDate);
      setDraftEndDate(filters.endDate);
      setDraftClients(filters.clients);
      setDraftMinAmount(filters.minAmount ?? amountBounds.min);
      setDraftMaxAmount(filters.maxAmount ?? amountBounds.max);
      setIsClientDropdownOpen(false);
      setIsStartCalendarOpen(false);
      setIsEndCalendarOpen(false);
      setStartMonthView(parseISODate(filters.startDate) ?? new Date());
      setEndMonthView(parseISODate(filters.endDate) ?? new Date());
    }
  }, [filters, amountBounds, isOpen]);

  React.useEffect(() => {
    if (!isClientDropdownOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(target)) {
        setIsClientDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isClientDropdownOpen]);

  React.useEffect(() => {
    const el = clientsScrollRef.current;
    if (!el) {
      setShowClientScrollHint(false);
      return;
    }

    const updateScrollHint = () => {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowClientScrollHint(remaining > 12);
    };

    updateScrollHint();
    el.addEventListener('scroll', updateScrollHint, { passive: true });
    window.addEventListener('resize', updateScrollHint);

    return () => {
      el.removeEventListener('scroll', updateScrollHint);
      window.removeEventListener('resize', updateScrollHint);
    };
  }, [normalizedClients, isOpen]);

  const activeFiltersCount = countActiveFilters(filters);
  const hasDateDraft = Boolean(draftStartDate && draftEndDate);
  const hasAmountDraft = Number.isFinite(draftMinAmount) && Number.isFinite(draftMaxAmount);
  const isDateDraftValid = !hasDateDraft || draftStartDate <= draftEndDate;
  const minGap = amountBounds.max > amountBounds.min ? 1 : 0;
  const isAmountDraftValid = !hasAmountDraft || (minGap === 0 ? draftMinAmount <= draftMaxAmount : draftMinAmount < draftMaxAmount);
  const canApply = isDateDraftValid && isAmountDraftValid;

  const amountSpan = Math.max(amountBounds.max - amountBounds.min, 1);
  const selectedMin = Math.min(Math.max(draftMinAmount, amountBounds.min), amountBounds.max);
  const selectedMax = Math.min(Math.max(draftMaxAmount, amountBounds.min), amountBounds.max);
  const leftPercent = ((selectedMin - amountBounds.min) / amountSpan) * 100;
  const rightPercent = ((selectedMax - amountBounds.min) / amountSpan) * 100;

  const resetDraft = () => {
    setDraftStartDate('');
    setDraftEndDate('');
    setDraftClients([]);
    setDraftMinAmount(amountBounds.min);
    setDraftMaxAmount(amountBounds.max);
    setIsClientDropdownOpen(false);
  };

  const resetApplied = () => {
    onFiltersChange({
      startDate: '',
      endDate: '',
      clients: [],
      minAmount: null,
      maxAmount: null,
    });
    resetDraft();
  };

  const handleApplyFilters = () => {
    if (!canApply) return;

    const roundedMinAmount = Math.round(draftMinAmount);
    const roundedMaxAmount = Math.round(draftMaxAmount);
    const hasCustomAmountRange =
      roundedMinAmount > amountBounds.min || roundedMaxAmount < amountBounds.max;

    onFiltersChange({
      startDate: draftStartDate,
      endDate: draftEndDate,
      clients: draftClients,
      minAmount: hasCustomAmountRange ? roundedMinAmount : null,
      maxAmount: hasCustomAmountRange ? roundedMaxAmount : null,
    });
    setIsOpen(false);
  };

  const setQuickDateRange = (daysBack: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - daysBack);
    const startValue = start.toISOString().slice(0, 10);
    const endValue = end.toISOString().slice(0, 10);
    setDraftStartDate(startValue);
    setDraftEndDate(endValue);
  };

  const setThisMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDraftStartDate(start.toISOString().slice(0, 10));
    setDraftEndDate(end.toISOString().slice(0, 10));
  };

  const setThisQuarterRange = () => {
    const now = new Date();
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), quarterStartMonth, 1);
    const end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
    setDraftStartDate(start.toISOString().slice(0, 10));
    setDraftEndDate(end.toISOString().slice(0, 10));
  };

  const setThisYearRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    setDraftStartDate(start.toISOString().slice(0, 10));
    setDraftEndDate(end.toISOString().slice(0, 10));
  };

  const handleStartDateInputChange = (value: string) => {
    setDraftStartDate(value);
    const parsed = parseISODate(value);
    if (parsed) {
      setStartMonthView(parsed);
    }
  };

  const handleEndDateInputChange = (value: string) => {
    setDraftEndDate(value);
    const parsed = parseISODate(value);
    if (parsed) {
      setEndMonthView(parsed);
    }
  };

  const toggleDraftClient = (client: string) => {
    setDraftClients((prev) => {
      const exists = prev.includes(client);
      if (exists) {
        return prev.filter((entry) => entry !== client);
      }
      return [...prev, client];
    });
  };

  const resetDateDraft = () => {
    setDraftStartDate('');
    setDraftEndDate('');
    const now = new Date();
    setStartMonthView(now);
    setEndMonthView(now);
  };

  const resetClientsDraft = () => {
    setDraftClients([]);
  };

  const resetAmountDraft = () => {
    setDraftMinAmount(amountBounds.min);
    setDraftMaxAmount(amountBounds.max);
  };

  const clientRows = normalizedClients.length;
  const clientsMaxHeight = clientRows <= 6 ? clientRows * 29 + 2 : 174;

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
          <span className="text-[12px] font-semibold capitalize text-slate-800 tracking-tight">
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
    <div className={cn('flex items-start', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-7 text-xs px-2.5', className)}
            onClick={() => setIsOpen(!isOpen)}
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-2.5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200" side="right" sideOffset={10} align="start" alignOffset={-24}>
          <div className="space-y-2">
            <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/85 p-1.5 space-y-1.5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
              <div className="flex items-center justify-between">
                <label className="pl-1 text-xs font-semibold text-slate-800">Fecha</label>
                <button
                  type="button"
                  onClick={resetDateDraft}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Por Defecto
                </button>
                {!isDateDraftValid ? (
                  <span className="text-[11px] text-red-600">Revisa el rango</span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="date"
                    value={draftStartDate}
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
                        draftStartDate,
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
                    value={draftEndDate}
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
                        draftEndDate,
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

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-1.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="pl-1 text-xs font-semibold text-slate-800">{clientLabel}</label>
                <div className="flex items-center gap-1">
                  {draftClients.length > 0 && (
                    <span className="text-[10px] text-slate-500">{draftClients.length} seleccionados</span>
                  )}
                  <button
                    type="button"
                    onClick={resetClientsDraft}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Por Defecto
                  </button>
                </div>
              </div>
              <div ref={clientDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsClientDropdownOpen((prev) => !prev)}
                  className="flex h-7 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700"
                >
                  <span className="truncate">
                    {draftClients.length === 0
                      ? `Selecionar ${clientLabel.toLowerCase()}s`
                      : draftClients.length === 1
                        ? draftClients[0]
                        : `${draftClients.length} seleccionados`}
                  </span>
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 text-slate-500 transition-transform', isClientDropdownOpen ? 'rotate-180' : '')}
                  />
                </button>

                {isClientDropdownOpen && (
                  <div className="absolute inset-x-0 top-[calc(100%+4px)] z-50 rounded-md border border-slate-200 bg-white shadow-sm animate-in fade-in-0 zoom-in-95 duration-150">
                    <div className="relative">
                      <div
                        className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-1 transition-all duration-300 ${
                          showClientScrollHint ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/88 px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-pulse" />
                          Deslizar para ver más
                        </div>
                      </div>
                      <div
                        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-white via-white/82 to-transparent transition-opacity duration-300 ${
                          showClientScrollHint ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <div
                        ref={clientsScrollRef}
                        className="overflow-y-auto pr-1"
                        style={{ maxHeight: clientsMaxHeight }}
                      >
                        {normalizedClients.length === 0 ? (
                          <div className="px-2 py-1.5 text-[11px] text-slate-500">No hay opciones disponibles</div>
                        ) : (
                          normalizedClients.map((client) => {
                            const isSelected = draftClients.includes(client);
                            return (
                              <label
                                key={client}
                                className="flex cursor-pointer items-center gap-2 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleDraftClient(client)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="truncate">{client}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-1.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800">Importe</label>
                <button
                  type="button"
                  onClick={resetAmountDraft}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Por Defecto
                </button>
                {!isAmountDraftValid ? (
                  <span className="text-[10px] text-red-600">Min debe ser menor que max</span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Input
                  type="number"
                  min={amountBounds.min}
                  max={Math.max(draftMaxAmount - minGap, amountBounds.min)}
                  step="1"
                  value={Number.isFinite(draftMinAmount) ? draftMinAmount : 0}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    const clamped = Math.max(amountBounds.min, Math.min(next, draftMaxAmount - minGap));
                    setDraftMinAmount(Math.round(clamped));
                  }}
                  className="h-7 bg-white text-[10px] leading-none [font-size:10px]"
                  style={{ fontSize: '11px' }}
                />
                <Input
                  type="number"
                  min={Math.min(draftMinAmount + minGap, amountBounds.max)}
                  max={amountBounds.max}
                  step="1"
                  value={Number.isFinite(draftMaxAmount) ? draftMaxAmount : 0}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    const clamped = Math.min(amountBounds.max, Math.max(next, draftMinAmount + minGap));
                    setDraftMaxAmount(Math.round(clamped));
                  }}
                  className="h-7 bg-white text-[10px] leading-none [font-size:10px]"
                  style={{ fontSize: '11px' }}
                />
              </div>
              <div className={cn('relative h-5', isClientDropdownOpen && 'opacity-0 pointer-events-none')}>
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
                <div
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-600"
                  style={{
                    left: `${leftPercent}%`,
                    width: `${Math.max(rightPercent - leftPercent, 0)}%`,
                  }}
                />
                <input
                  type="range"
                  min={amountBounds.min}
                  max={amountBounds.max}
                  step="1"
                  value={selectedMin}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    const clamped = Math.min(next, draftMaxAmount - minGap);
                    setDraftMinAmount(Math.round(clamped));
                  }}
                  className="pointer-events-none absolute inset-0 z-30 h-5 w-full appearance-none bg-transparent [margin:0] [padding:0] [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-blue-600 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-sm"
                  style={{ width: 'calc(100% + 8px)', left: '-4px' }}
                />
                <input
                  type="range"
                  min={amountBounds.min}
                  max={amountBounds.max}
                  step="1"
                  value={selectedMax}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    const clamped = Math.max(next, draftMinAmount + minGap);
                    setDraftMaxAmount(Math.round(clamped));
                  }}
                  className="pointer-events-none absolute inset-0 z-20 h-5 w-full appearance-none bg-transparent [margin:0] [padding:0] [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-blue-600 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-blue-600 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-sm"
                  style={{ width: 'calc(100% + 8px)', left: '-4px' }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>0 €</span>
                <span>{formatAmount(amountBounds.max)} €</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={resetApplied}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3 w-3" />
                Quitar Filtros
              </button>
              <Button
                size="sm"
                className="h-7 bg-blue-600 hover:bg-blue-700 px-3 text-xs text-white"
                disabled={!canApply}
                onClick={handleApplyFilters}
              >
                Filtrar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
