import React from 'react';
import { LucideProps } from 'lucide-react';
interface StatCardProps {
  title: string;
  value: string;
  percentage?: number;
  Icon: React.ComponentType<LucideProps>;
  statusText?: string;
  iconColor?: string;
  size?: 'lg' | 'md' | 'compact';
  variant?: 'default' | 'green' | 'red';
  showIcon?: boolean;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  percentage,
  Icon,
  statusText,
  iconColor,
  size = 'lg',
  variant = 'default',
  showIcon = true,
  className,
}) => {
  const hasPercentage = typeof percentage === 'number';
  const isPositive = (percentage ?? 0) >= 0;

  const containerClasses =
    size === 'lg'
      ? 'h-44 px-7 py-6'
      : size === 'md'
        ? 'h-32 px-6 py-4'
        : 'h-28 px-4 py-4';

  const valueClasses =
    size === 'lg'
      ? 'text-5xl md:text-6xl'
      : size === 'md'
        ? 'text-4xl md:text-5xl'
        : 'text-3xl md:text-4xl';

  const iconSize = size === 'lg' ? 26 : size === 'md' ? 22 : 20;

  const variantClasses = {
    default: 'bg-white text-gray-700',
    green: 'bg-green-100 text-green-900',
    red: 'bg-red-50 text-red-800',
  };

  const valueColorClasses = {
    default: 'text-gray-900',
    green: 'text-green-900',
    red: 'text-red-800',
  };

  return (
    <div className={`rounded-2xl border border-gray-200 w-full flex flex-col gap-3 ${containerClasses} ${variantClasses[variant]} ${className ?? ''}`}>
      <span className="text-base md:text-lg font-light text-gray-600 tracking-wide break-words">{title}</span>

      <div className="flex items-center justify-between">
        <p className={`${valueClasses} font-light tracking-tight ${valueColorClasses[variant]}`}>{value}</p>
        <div className="flex items-center gap-3">
          {hasPercentage && (
            <span className={`text-sm md:text-base font-light tracking-wide ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{percentage}%
            </span>
          )}
          {!hasPercentage && statusText && (
            <span className="text-sm md:text-base font-light tracking-wide text-green-500">{statusText}</span>
          )}
          {showIcon && (
            <div className={`p-3 rounded-full border ${iconColor ? 'border-transparent' : 'border-blue-100'} ${iconColor ? '' : 'bg-blue-50'}`}>
              <Icon size={iconSize} className={iconColor || 'text-blue-600'} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
