"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface InvoiceContextType {
  income: {
    total: number;
    count: number;
  };
  expenses: {
    total: number;
    count: number;
  };
  setIncomeData: (total: number, count: number) => void;
  setExpensesData: (total: number, count: number) => void;
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);

export function InvoiceProvider({ children }: { children: ReactNode }) {
  const [income, setIncome] = useState({ total: 0, count: 0 });
  const [expenses, setExpenses] = useState({ total: 0, count: 0 });

  const setIncomeData = (total: number, count: number) => {
    setIncome({ total, count });
  };

  const setExpensesData = (total: number, count: number) => {
    setExpenses({ total, count });
  };

  return (
    <InvoiceContext.Provider value={{ income, expenses, setIncomeData, setExpensesData }}>
      {children}
    </InvoiceContext.Provider>
  );
}

export const useInvoices = () => {
  const context = useContext(InvoiceContext);
  if (context === undefined) {
    throw new Error('useInvoices must be used within an InvoiceProvider');
  }
  return context;
};
