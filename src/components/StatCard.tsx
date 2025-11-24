import React from 'react';
import Link from 'next/link';
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
  href?: string;
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
  href,
}) => {
  const hasPercentage = typeof percentage === 'number';
  const isPositive = (percentage ?? 0) >= 0;

  const containerClasses =
    size === 'lg'
      ? 'h-44 px-7 py-6'
      : size === 'md'
        ? 'h-32 px-6 py-4'
        : 'h-24 px-4 py-3';

  const valueClasses =
    size === 'lg'
      ? 'text-4xl md:text-5xl'
      : size === 'md'
        ? 'text-3xl md:text-4xl'
        : 'text-lg md:text-xl';

  const iconSize = size === 'lg' ? 26 : size === 'md' ? 22 : 18;

  const variantClasses = {
    default: 'bg-white text-gray-700',
    green: 'bg-white text-gray-700',
    red: 'bg-white text-gray-700',
  };

  const valueColorClasses = {
    default: 'text-gray-900',
    green: 'text-green-900',
    red: 'text-red-800',
  };

  const cardClasses = [
    'rounded-2xl border border-gray-200 w-full flex flex-col gap-3',
    containerClasses,
    variantClasses[variant],
    className ?? '',
    href ? 'transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-blue-200 cursor-pointer' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <div className={cardClasses}>
      <span className="text-sm md:text-base font-light text-gray-600 tracking-wide break-words">{title}</span>

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

  if (href) {
    return (
      <Link
        href={href}
        className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-2xl"
      >
        {content}
      </Link>
    );
  }

  return content;
};

export default StatCard;
