import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import BalanceChart from '@/components/BalanceChart';
import Integrations from '@/components/Integrations';
import ClerioChat from '@/components/ClerioChat';
import { FileText, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="-m-8">
      <div className="bg-white pt-8 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <Header />
          <div className="flex flex-col md:flex-row md:justify-between gap-4 md:gap-6 max-w-5xl mx-auto">
            <StatCard 
              title="Facturas Procesadas"
              value="220"
              percentage={22}
              Icon={FileText}
              size="compact"
              className="md:w-[300px]"
            />
            <StatCard 
              title="Ingresos"
              value="8070€"
              percentage={41}
              Icon={ArrowUpCircle}
              size="compact"
              className="md:w-[300px]"
              href="/ingresos"
            />
            <StatCard 
              title="Gastos"
              value="3260€"
              percentage={-16}
              Icon={ArrowDownCircle}
              size="compact"
              className="md:w-[300px]"
              href="/gastos"
            />
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
              <ClerioChat />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
