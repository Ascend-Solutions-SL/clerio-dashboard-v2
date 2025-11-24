'use client';

import * as React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TableFiltersProps {
  onDateRangeChange: (startDate: string, endDate: string) => void;
  activeDateRange?: {
    startDate: string;
    endDate: string;
  };
  className?: string;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
const months = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];
const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));

export function TableFilters({
  onDateRangeChange,
  activeDateRange,
  className,
}: TableFiltersProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [startDay, setStartDay] = React.useState<string>('');
  const [startMonth, setStartMonth] = React.useState<string>('');
  const [startYear, setStartYear] = React.useState<string>('');
  const [endDay, setEndDay] = React.useState<string>('');
  const [endMonth, setEndMonth] = React.useState<string>('');
  const [endYear, setEndYear] = React.useState<string>('');

  const resetFilters = () => {
    setStartDay('');
    setStartMonth('');
    setStartYear('');
    setEndDay('');
    setEndMonth('');
    setEndYear('');
    onDateRangeChange('', '');
  };

  React.useEffect(() => {
    if (activeDateRange?.startDate && activeDateRange?.endDate) {
      const [appliedStartYear = '', appliedStartMonth = '', appliedStartDay = ''] = activeDateRange.startDate.split('-');
      const [appliedEndYear = '', appliedEndMonth = '', appliedEndDay = ''] = activeDateRange.endDate.split('-');

      setStartDay(appliedStartDay);
      setStartMonth(appliedStartMonth);
      setStartYear(appliedStartYear);
      setEndDay(appliedEndDay);
      setEndMonth(appliedEndMonth);
      setEndYear(appliedEndYear);
    } else {
      setStartDay('');
      setStartMonth('');
      setStartYear('');
      setEndDay('');
      setEndMonth('');
      setEndYear('');
    }
  }, [activeDateRange?.startDate, activeDateRange?.endDate]);

  const hasAppliedDateFilter = Boolean(activeDateRange?.startDate && activeDateRange?.endDate);
  const activeFiltersCount = hasAppliedDateFilter ? 1 : 0;
  const canApplyDateFilter = Boolean(startDay && startMonth && startYear && endDay && endMonth && endYear);

  const handleApplyFilters = () => {
    if (!canApplyDateFilter) return;
    const startDate = `${startYear}-${startMonth}-${startDay}`;
    const endDate = `${endYear}-${endMonth}-${endDay}`;
    onDateRangeChange(startDate, endDate);
    setIsOpen(false);
  };

  return (
    <div className={cn('flex items-start', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-8 border-dashed', className)}
            onClick={() => setIsOpen(!isOpen)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="ml-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">

            {/* Date Range Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Rango de fechas</label>
                {(startDay || startMonth || startYear || endDay || endMonth || endYear || hasAppliedDateFilter) && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Limpiar
                  </button>
                )}
              </div>

              <div className="grid gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Inicio:</p>
                  <div className="flex space-x-2">
                    <Select
                      value={startDay}
                      onValueChange={(value) => setStartDay(value)}
                    >
                      <SelectTrigger className="w-16 text-center">
                        <SelectValue placeholder="Día" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {days.map((day) => (
                          <SelectItem key={`start-${day}`} value={day} className="justify-center !pl-2">
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={startMonth}
                      onValueChange={(value) => setStartMonth(value)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="Mes" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {months.map((month) => (
                          <SelectItem key={`start-${month.value}`} value={month.value} className="text-center">
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={startYear}
                      onValueChange={(value) => setStartYear(value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Año" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {years.map((year) => (
                          <SelectItem key={`start-${year}`} value={year.toString()} className="justify-center !pl-2">
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fin:</p>
                  <div className="flex space-x-2">
                    <Select
                      value={endDay}
                      onValueChange={(value) => setEndDay(value)}
                    >
                      <SelectTrigger className="w-16 text-center">
                        <SelectValue placeholder="Día" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {days.map((day) => (
                          <SelectItem key={`end-${day}`} value={day} className="justify-center !pl-2">
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={endMonth}
                      onValueChange={(value) => setEndMonth(value)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="Mes" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {months.map((month) => (
                          <SelectItem key={`end-${month.value}`} value={month.value} className="text-center">
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={endYear}
                      onValueChange={(value) => setEndYear(value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Año" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {years.map((year) => (
                          <SelectItem key={`end-${year}`} value={year.toString()} className="justify-center !pl-2">
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!canApplyDateFilter}
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
