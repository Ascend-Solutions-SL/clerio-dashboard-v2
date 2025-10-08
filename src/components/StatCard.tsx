import React from 'react';
import { LucideProps } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  percentage?: number;
  Icon: React.ComponentType<LucideProps>;
  statusText?: string;
  iconColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, percentage, Icon, statusText, iconColor }) => {
  const hasPercentage = typeof percentage === 'number';
  const isPositive = (percentage ?? 0) >= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-36 w-full px-5 py-4 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600 bg-gray-100 rounded-full px-3 py-1 font-medium">
          {title}
        </span>
        {hasPercentage && (
          <span className={`text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{percentage}%
          </span>
        )}
        {!hasPercentage && statusText && (
          <span className="text-sm font-semibold text-green-500">{statusText}</span>
        )}
      </div>

      <div className="flex items-center justify-start">
        <div className={`p-3 rounded-full ${iconColor ? '' : 'bg-blue-50'} mr-4 border ${iconColor ? 'border-transparent' : 'border-blue-100'}`}>
          <Icon size={22} className={iconColor || 'text-blue-600'} />
        </div>
        <p className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;
