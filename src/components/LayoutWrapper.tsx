'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-blue-600">
      <Sidebar isOpen={isSidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 p-4">
        <main className="w-full h-full bg-gray-50 rounded-2xl p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default LayoutWrapper;
