import React from 'react';
import { LucideProps } from 'lucide-react';
import { Nunito } from 'next/font/google';
const nunito = Nunito({ subsets: ['latin'], weight: ['600','700','800'] });

interface StatCardProps {
  title: string;
  value: string;
  percentage?: number;
  Icon: React.ComponentType<LucideProps>;
  statusText?: string;
  iconColor?: string;
  size?: 'lg' | 'md';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, percentage, Icon, statusText, iconColor, size = 'lg' }) => {
  const hasPercentage = typeof percentage === 'number';
  const isPositive = (percentage ?? 0) >= 0;

  const containerClasses = size === 'lg'
    ? 'h-44 px-7 py-6'
    : 'h-32 px-6 py-4';

  const valueClasses = size === 'lg'
    ? 'text-5xl md:text-6xl'
    : 'text-4xl md:text-5xl';

  const iconSize = size === 'lg' ? 26 : 22;

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 w-full flex flex-col justify-between ${containerClasses}`}>
      <div className="flex items-start justify-between">
        <span className={`text-sm md:text-base text-gray-700 font-semibold ${nunito.className}`}>{title}</span>
        {hasPercentage && (
          <span className={`text-sm md:text-base font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{percentage}%
          </span>
        )}
        {!hasPercentage && statusText && (
          <span className="text-sm md:text-base font-semibold text-green-500">{statusText}</span>
        )}
      </div>

      <div className="flex items-center">
        <p className={`${valueClasses} font-extrabold text-gray-900 tracking-tight ${nunito.className}`}>{value}</p>
        <div className={`p-3 rounded-full ml-3 border ${iconColor ? 'border-transparent' : 'border-blue-100'} ${iconColor ? '' : 'bg-blue-50'}`}>
          <Icon size={iconSize} className={iconColor || 'text-blue-600'} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
