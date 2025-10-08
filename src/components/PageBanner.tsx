import React from 'react';

interface PageBannerProps {
  title: string;
  color: 'green' | 'red';
}

const PageBanner: React.FC<PageBannerProps> = ({ title, color }) => {
  const colorClasses = {
    green: 'bg-green-200 text-green-900',
    red: 'bg-red-100 text-red-800',
  };

  return (
    <div className={`rounded-lg px-3 py-3 mb-5 -mt-10 ${colorClasses[color]}`}>
      <h1 className="text-lg font-semibold text-center pt-1">{title}</h1>
    </div>
  );
};

export default PageBanner;
