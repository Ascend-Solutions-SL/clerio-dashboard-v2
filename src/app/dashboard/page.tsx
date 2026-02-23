"use client";

import * as React from 'react';

import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import BalanceChart from '@/components/BalanceChart';
import Integrations from '@/components/Integrations';
import { FileText, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useFinancialData } from '@/context/FinancialDataContext';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function DashboardHome() {
  const { data, loading } = useFinancialData();
  const { user, isLoading: isSessionLoading } = useDashboardSession();

  const [period, setPeriod] = React.useState<'total' | 'month' | 'quarter' | 'year' | 'custom'>('total');
  const [customRange, setCustomRange] = React.useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });
  const [cardsLoading, setCardsLoading] = React.useState(false);
  const [cardsTotals, setCardsTotals] = React.useState<{
    totalIncome: number;
    incomeCount: number;
    totalExpenses: number;
    expenseCount: number;
  } | null>(null);

  const periodRange = React.useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (period === 'total') {
      return null;
    }

    if (period === 'custom') {
      const start = customRange.startDate?.trim() || '';
      const end = customRange.endDate?.trim() || '';
      return start && end ? { start, end } : null;
    }

    if (period === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = now;
      return { start: toIsoDate(start), end: toIsoDate(end) };
    }

    if (period === 'quarter') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterStartMonth, 1);
      const end = now;
      return { start: toIsoDate(start), end: toIsoDate(end) };
    }

    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = now;
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }, [customRange.endDate, customRange.startDate, period]);

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

    if (period === 'custom' && !periodRange) {
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

          if (periodRange) {
            q = q.gte('fecha', periodRange.start).lte('fecha', periodRange.end);
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
  }, [customRange.endDate, customRange.startDate, isSessionLoading, period, periodRange, user?.businessName, user?.empresaId]);

  const sourceTotals = cardsTotals ?? data;

  const totalInvoices = sourceTotals ? sourceTotals.incomeCount + sourceTotals.expenseCount : 0;
  const totalIncome = sourceTotals?.totalIncome ?? 0;
  const totalExpenses = sourceTotals?.totalExpenses ?? 0;

  const formatCurrency = (value: number) =>
    value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="-m-8">
      <div className="bg-white pt-8 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <Header />
          <div className="flex flex-col gap-3 max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="text-xs font-semibold text-slate-600">Período</div>
              <div className="w-[160px]">
                <Select value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total</SelectItem>
                    <SelectItem value="month">Mes actual</SelectItem>
                    <SelectItem value="quarter">Trimestre actual</SelectItem>
                    <SelectItem value="year">Año actual</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {period === 'custom' ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="h-8"
                    value={customRange.startDate}
                    onChange={(e) => setCustomRange((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                  <span className="text-sm text-slate-400">—</span>
                  <Input
                    type="date"
                    className="h-8"
                    value={customRange.endDate}
                    onChange={(e) => setCustomRange((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              ) : null}
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
