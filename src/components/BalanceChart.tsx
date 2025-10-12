'use client';

import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const rawData = [
  { name: 'E', ingresos: 4000, gastos: 2400 },
  { name: 'F', ingresos: 3000, gastos: 1398 },
  { name: 'M', ingresos: 2000, gastos: 9800 },
  { name: 'A', ingresos: 2780, gastos: 3908 },
  { name: 'M', ingresos: 1890, gastos: 4800 },
  { name: 'J', ingresos: 2390, gastos: 3800 },
  { name: 'J', ingresos: 5990, gastos: 4300 },
  { name: 'A', ingresos: 3490, gastos: 4300 },
  { name: 'S', ingresos: 2000, gastos: 2400 },
  { name: 'O', ingresos: 3000, gastos: 1398 },
  { name: 'N', ingresos: 2780, gastos: 3908 },
  { name: 'D', ingresos: 1890, gastos: 4800 },
];

const data = rawData.map((item) => ({
  ...item,
  total: item.ingresos - item.gastos,
}));

const BalanceChart = () => {
  const [activeTab, setActiveTab] = useState('Ingresos');

  const activeDataKey = activeTab.toLowerCase();

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Balance actual</h2>
          <p className="text-sm text-gray-500">Tenemos un ascenso en los ingresos de un 20% respecto al año anterior.</p>
        </div>
        <div className="text-sm text-gray-600">Último año</div>
      </div>
      <div className="flex gap-2 border-b mb-4 pb-2">
        {['Ingresos', 'Gastos', 'Total'].map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ${
                isActive
                  ? 'text-blue-600 bg-blue-50 shadow-md shadow-blue-500/20 border border-blue-200 -translate-y-0.5'
                  : 'text-gray-500 hover:text-blue-600 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md hover:shadow-blue-500/15 border border-transparent'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          );
        })}
      </div>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            <YAxis width={50} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey={activeDataKey} fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BalanceChart;
