'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
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

interface Client {
  id: string;
  name: string;
}

interface TableFiltersProps {
  clients: Client[];
  onClientChange: (clientId: string) => void;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  className?: string;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
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
  clients,
  onClientChange,
  onDateRangeChange,
  className,
}: TableFiltersProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<string>('');
  const [startDay, setStartDay] = React.useState<string>('');
  const [startMonth, setStartMonth] = React.useState<string>('');
  const [startYear, setStartYear] = React.useState<string>('');
  const [endDay, setEndDay] = React.useState<string>('');
  const [endMonth, setEndMonth] = React.useState<string>('');
  const [endYear, setEndYear] = React.useState<string>('');

  const truncateText = (text: string, maxLength: number = 15) => {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    onClientChange(clientId);
  };

  const handleDateChange = () => {
    if (startDay && startMonth && startYear && endDay && endMonth && endYear) {
      const startDate = `${startYear}-${startMonth}-${startDay}`;
      const endDate = `${endYear}-${endMonth}-${endDay}`;
      onDateRangeChange(startDate, endDate);
    }
  };

  React.useEffect(() => {
    handleDateChange();
  }, [startDay, startMonth, startYear, endDay, endMonth, endYear]);

  const resetFilters = () => {
    setSelectedClient('');
    setStartDay('');
    setStartMonth('');
    setStartYear('');
    setEndDay('');
    setEndMonth('');
    setEndYear('');
    onClientChange('');
    onDateRangeChange('', '');
  };

  const hasDateFilter = startDay && startMonth && startYear && endDay && endMonth && endYear;
  const activeFiltersCount = [
    selectedClient ? true : false,
    hasDateFilter
  ].filter(Boolean).length;

  return (
    <div className={cn('flex items-start', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            {isOpen ? (
              <ChevronUp className="h-4 w-4 ml-1 opacity-50" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Rango de fechas</h4>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Fecha inicial</p>
                  <div className="flex gap-2">
                    <Select value={startDay} onValueChange={setStartDay}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Día" />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={`start-day-${day}`} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={startMonth} onValueChange={setStartMonth}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Mes" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={`start-month-${month.value}`} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={startYear} onValueChange={setStartYear}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Año" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={`start-year-${year}`} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Fecha final</p>
                  <div className="flex gap-2">
                    <Select value={endDay} onValueChange={setEndDay}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Día" />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={`end-day-${day}`} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={endMonth} onValueChange={setEndMonth}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Mes" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={`end-month-${month.value}`} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={endYear} onValueChange={setEndYear}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Año" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={`end-year-${year}`} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Cliente</h4>
              <Select onValueChange={handleClientChange} value={selectedClient}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem 
                      key={client.id} 
                      value={client.id}
                      className="relative group"
                    >
                      <div className="whitespace-normal break-words w-full">
                        {client.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end pt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFilters}
                className="text-sm"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar filtros
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
