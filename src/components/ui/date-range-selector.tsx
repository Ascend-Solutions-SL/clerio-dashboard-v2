'use client';

import * as React from 'react';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type DateRangeValue = {
  startDate: string;
  endDate: string;
};

type DateRangeSelectorProps = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  className?: string;
};

type SubmenuType = 'years' | 'quarters' | 'months' | null;

type PresetItem = {
  key: string;
  label: string;
  resolve: () => DateRangeValue;
};

const WEEK_DAYS = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'];
const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseISODate = (value: string) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const formatRangeLabel = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) {
    return 'Seleccionar periodo';
  }

  const [sy, sm, sd] = startDate.split('-');
  const [ey, em, ed] = endDate.split('-');
  if (!sy || !sm || !sd || !ey || !em || !ed) {
    return `${startDate} - ${endDate}`;
  }

  return `${sd}/${sm}/${sy} - ${ed}/${em}/${ey}`;
};

const formatDisplayDate = (isoDate: string) => {
  if (!isoDate) {
    return '';
  }

  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) {
    return isoDate;
  }

  return `${day}/${month}/${year}`;
};

const getTodayRange = (): DateRangeValue => {
  const today = new Date();
  const iso = toISODate(today);
  return { startDate: iso, endDate: iso };
};

const getYesterdayRange = (): DateRangeValue => {
  const day = new Date();
  day.setDate(day.getDate() - 1);
  const iso = toISODate(day);
  return { startDate: iso, endDate: iso };
};

const getLastDaysRange = (days: number): DateRangeValue => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { startDate: toISODate(start), endDate: toISODate(end) };
};

const getCurrentMonthRange = (): DateRangeValue => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: toISODate(start), endDate: toISODate(end) };
};

const getPreviousMonthRange = (): DateRangeValue => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { startDate: toISODate(start), endDate: toISODate(end) };
};

const getCurrentQuarterRange = (): DateRangeValue => {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth, 1);
  const end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
  return { startDate: toISODate(start), endDate: toISODate(end) };
};

const getPreviousQuarterRange = (): DateRangeValue => {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth - 3, 1);
  const end = new Date(now.getFullYear(), quarterStartMonth, 0);
  return { startDate: toISODate(start), endDate: toISODate(end) };
};

const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return { startDate: toISODate(start), endDate: toISODate(end) };
};

const getPreviousYearRange = (): DateRangeValue => {
  const now = new Date();
  const year = now.getFullYear() - 1;
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return { startDate: toISODate(start), endDate: toISODate(end) };
};

const isSameRange = (a: DateRangeValue, b: DateRangeValue) => a.startDate === b.startDate && a.endDate === b.endDate;

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

  while (cells.length < 42) {
    cells.push(new Date(year, month + 1, cells.length - (leading + daysInMonth) + 1));
  }

  return cells;
};

export function DateRangeSelector({ value, onChange, className }: DateRangeSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRangeValue>(value);
  const [submenu, setSubmenu] = React.useState<SubmenuType>(null);
  const [showCustom, setShowCustom] = React.useState(false);
  const [startMonthView, setStartMonthView] = React.useState<Date>(() => parseISODate(value.startDate) ?? new Date());
  const [endMonthView, setEndMonthView] = React.useState<Date>(() => parseISODate(value.endDate) ?? new Date());

  React.useEffect(() => {
    if (!open) {
      setDraft(value);
      setSubmenu(null);
      setShowCustom(false);
      setStartMonthView(parseISODate(value.startDate) ?? new Date());
      setEndMonthView(parseISODate(value.endDate) ?? new Date());
    }
  }, [open, value]);

  const recentPresets = React.useMemo<PresetItem[]>(
    () => [
      { key: 'today', label: 'Hoy', resolve: getTodayRange },
      { key: 'yesterday', label: 'Ayer', resolve: getYesterdayRange },
      { key: 'last7', label: 'Últimos 7 días', resolve: () => getLastDaysRange(7) },
    ],
    []
  );

  const currentPeriodPresets = React.useMemo<PresetItem[]>(
    () => [
      { key: 'thisMonth', label: 'Mes actual', resolve: getCurrentMonthRange },
      { key: 'thisQuarter', label: 'Trimestre actual', resolve: getCurrentQuarterRange },
      { key: 'thisYear', label: 'Año actual', resolve: getCurrentYearRange },
    ],
    []
  );

  const previousPeriodPresets = React.useMemo<PresetItem[]>(
    () => [
      { key: 'prevMonth', label: 'Mes anterior', resolve: getPreviousMonthRange },
      { key: 'prevQuarter', label: 'Trimestre anterior', resolve: getPreviousQuarterRange },
      { key: 'prevYear', label: 'Año anterior', resolve: getPreviousYearRange },
    ],
    []
  );

  const yearsOptions = React.useMemo(() => {
    const now = new Date();
    return Array.from({ length: 8 }).map((_, index) => now.getFullYear() - index);
  }, []);

  const quarterOptions = React.useMemo(() => {
    const now = new Date();
    const out: Array<{ label: string; value: DateRangeValue }> = [];

    for (let offset = 0; offset < 8; offset += 1) {
      const base = new Date(now.getFullYear(), now.getMonth() - offset * 3, 1);
      const quarterStartMonth = Math.floor(base.getMonth() / 3) * 3;
      const start = new Date(base.getFullYear(), quarterStartMonth, 1);
      const end = new Date(base.getFullYear(), quarterStartMonth + 3, 0);
      const quarter = Math.floor(quarterStartMonth / 3) + 1;
      out.push({
        label: `T${quarter} ${base.getFullYear()}`,
        value: { startDate: toISODate(start), endDate: toISODate(end) },
      });
    }

    return out;
  }, []);

  const monthOptions = React.useMemo(() => {
    const now = new Date();
    const out: Array<{ label: string; value: DateRangeValue }> = [];

    for (let offset = 0; offset < 8; offset += 1) {
      const base = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const start = new Date(base.getFullYear(), base.getMonth(), 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      out.push({
        label: `${MONTH_NAMES[base.getMonth()]} ${base.getFullYear()}`,
        value: { startDate: toISODate(start), endDate: toISODate(end) },
      });
    }

    return out;
  }, []);

  const applyRange = (next: DateRangeValue) => {
    setDraft(next);
    onChange(next);
  };

  const handleCustomInputChange = (type: 'start' | 'end', raw: string) => {
    const next = { ...draft, [type === 'start' ? 'startDate' : 'endDate']: raw };
    if (next.startDate && next.endDate && next.startDate > next.endDate) {
      if (type === 'start') {
        next.endDate = raw;
      } else {
        next.startDate = raw;
      }
    }
    setDraft(next);
    onChange(next);

    const parsed = parseISODate(raw);
    if (parsed) {
      if (type === 'start') {
        setStartMonthView(parsed);
      } else {
        setEndMonthView(parsed);
      }
    }
  };

  const handleCalendarPick = (type: 'start' | 'end', isoDate: string) => {
    handleCustomInputChange(type, isoDate);
  };

  const renderCalendar = (
    monthView: Date,
    setMonthView: React.Dispatch<React.SetStateAction<Date>>,
    selectedIso: string,
    onSelect: (isoDate: string) => void
  ) => {
    const monthDays = getCalendarDays(monthView);
    const activeMonth = monthView.getMonth();

    return (
      <div className="w-[250px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => setMonthView((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1">
            <div className="relative">
              <select
                className="h-8 appearance-none rounded-md border border-slate-200 bg-white px-2 pr-5 text-[11px] font-medium text-slate-700 text-center [text-align-last:center] outline-none ring-0 focus:border-slate-300"
                value={monthView.getMonth()}
                onChange={(event) => {
                  const nextMonth = Number(event.target.value);
                  setMonthView((prev) => new Date(prev.getFullYear(), nextMonth, 1));
                }}
              >
                {MONTH_NAMES.map((monthLabel, index) => (
                  <option key={monthLabel} value={index}>
                    {monthLabel}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-slate-500" />
            </div>

            <div className="relative">
              <select
                className="h-8 appearance-none rounded-md border border-slate-200 bg-white px-2 pr-5 text-[11px] font-medium text-slate-700 text-center [text-align-last:center] outline-none ring-0 focus:border-slate-300"
                value={monthView.getFullYear()}
                onChange={(event) => {
                  const nextYear = Number(event.target.value);
                  setMonthView((prev) => new Date(nextYear, prev.getMonth(), 1));
                }}
              >
                {yearsOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMonthView((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="py-0.5">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {monthDays.map((dayDate) => {
            const iso = toISODate(dayDate);
            const isCurrentMonth = dayDate.getMonth() === activeMonth;
            const isSelected = selectedIso === iso;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSelect(iso)}
                className={cn(
                  'h-7 rounded-md text-[12px] font-normal',
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isCurrentMonth
                      ? 'text-slate-800 hover:bg-slate-100'
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

  const renderPresetColumn = (title: string, items: PresetItem[]) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-1.5">
      <div className="mb-1 text-[11px] font-bold text-slate-700">{title}</div>
      <div className="space-y-1">
        {items.map((item) => {
          const presetValue = item.resolve();
          const isActive = isSameRange(draft, presetValue);

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                applyRange(presetValue);
                setShowCustom(false);
                setSubmenu(null);
              }}
              className={cn(
                'flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] font-medium text-slate-800 hover:bg-slate-100',
                isActive && 'bg-slate-100'
              )}
            >
              <Check className={cn('h-3 w-3 text-blue-600', isActive ? 'opacity-100' : 'opacity-0')} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const getSubmenuEntries = (type: SubmenuType): Array<{ key: string; label: string; value: DateRangeValue }> => {
    if (type === 'years') {
      return yearsOptions
        .map((year) => ({
          key: String(year),
          label: String(year),
          value: { startDate: `${year}-01-01`, endDate: `${year}-12-31` },
        }))
        .reverse();
    }

    if (type === 'quarters') {
      return quarterOptions.map((entry) => ({ key: entry.label, label: entry.label, value: entry.value })).reverse();
    }

    if (type === 'months') {
      return monthOptions.map((entry) => ({ key: entry.label, label: entry.label, value: entry.value })).reverse();
    }

    return [];
  };

  const renderSubmenuTrigger = (type: Exclude<SubmenuType, null>, label: string) => {
    const entries = getSubmenuEntries(type);
    const isOpen = submenu === type;

    const handleMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
      const next = event.relatedTarget as Node | null;
      if (next && event.currentTarget.contains(next)) {
        return;
      }
      setSubmenu((prev) => (prev === type ? null : prev));
    };

    return (
      <div
        className="relative"
        onMouseEnter={() => setSubmenu(type)}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          onClick={() => {
            setShowCustom(false);
            setSubmenu((prev) => (prev === type ? null : type));
          }}
          className={cn(
            'flex h-7.5 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50',
            isOpen && 'border-slate-300 bg-slate-50'
          )}
        >
          <span>{label}</span>
          <ChevronDown className="h-3 w-3 -rotate-180 text-slate-500" />
        </button>

        {isOpen ? (
          <div
            className="absolute bottom-full left-0 z-30 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
            onMouseEnter={() => setSubmenu(type)}
            onMouseLeave={handleMouseLeave}
          >
            <div className={cn(type === 'months' ? 'p-1' : 'max-h-52 overflow-y-auto p-1')}>
              {entries.map((entry) => {
                const isActive = isSameRange(draft, entry.value);

                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => {
                      applyRange(entry.value);
                      setShowCustom(false);
                      setSubmenu(null);
                    }}
                    className={cn(
                      'flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] font-medium text-slate-800 hover:bg-slate-100',
                      isActive && 'bg-slate-100'
                    )}
                  >
                    <Check className={cn('h-3 w-3 text-blue-600', isActive ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{entry.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 min-w-[210px] items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 shadow-sm hover:border-slate-300',
            className
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
            <span className="truncate">{formatRangeLabel(value.startDate, value.endDate)}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[560px] max-w-[calc(100vw-1.5rem)] p-0">
        <div className="bg-white p-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            {renderPresetColumn('Período anterior', previousPeriodPresets)}
            {renderPresetColumn('Período actual', currentPeriodPresets)}
            {renderPresetColumn('Recientes', recentPresets)}
          </div>

          <div className="relative mt-2 border-t border-slate-300 pt-2 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.2)]">
            <div className="grid grid-cols-3 gap-1.5">
              {renderSubmenuTrigger('years', 'Años')}
              {renderSubmenuTrigger('quarters', 'Trimestres')}
              {renderSubmenuTrigger('months', 'Meses')}
            </div>

            <div
              className="relative mt-2 flex justify-end"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setShowCustom(false);
                }
              }}
            >
              <div
                className={cn(
                  'absolute bottom-full right-0 z-20 mb-1 w-[520px] origin-bottom-right rounded-xl border border-blue-200 bg-white p-2 shadow-lg ring-1 ring-blue-100 transition-all duration-200 ease-out',
                  showCustom ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0'
                )}
              >
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={formatDisplayDate(draft.startDate)}
                      readOnly
                      className="h-7 px-2 text-[10px] text-center"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={formatDisplayDate(draft.endDate)}
                      readOnly
                      className="h-7 px-2 text-[10px] text-center"
                    />
                  </div>
                </div>

                <div className="mt-2 flex gap-2">
                  {renderCalendar(startMonthView, setStartMonthView, draft.startDate, (iso) => handleCalendarPick('start', iso))}
                  {renderCalendar(endMonthView, setEndMonthView, draft.endDate, (iso) => handleCalendarPick('end', iso))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSubmenu(null);
                  setShowCustom((prev) => !prev);
                }}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  showCustom
                    ? 'border-blue-200 bg-blue-100 text-blue-800'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                )}
              >
                Período personalizado
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const getDefaultCurrentYearRange = (): DateRangeValue => getCurrentYearRange();
export const getDefaultCurrentQuarterRange = (): DateRangeValue => getCurrentQuarterRange();
