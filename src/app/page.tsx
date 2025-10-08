import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import BalanceChart from '@/components/BalanceChart';
import Integrations from '@/components/Integrations';
import ClerioChat from '@/components/ClerioChat';
import { FileText, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

export default function Home() {
  return (
    <div>
      <Header />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard 
          title="Facturas Procesadas"
          value="220"
          percentage={22}
          Icon={FileText}
        />
        <StatCard 
          title="Ingresos"
          value="8070€"
          percentage={41}
          Icon={ArrowUpCircle}
        />
        <StatCard 
          title="Gastos"
          value="3260€"
          percentage={-16} // Negative for decrease
          Icon={ArrowDownCircle}
        />
      </div>
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
  );
}
