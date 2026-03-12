'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import MasterSidebar from './MasterSidebar';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ children }) => {
  const pathname = usePathname();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMasterSidebarOpen, setMasterSidebarOpen] = useState(false);
  const isClerIA = pathname === '/dashboard/cleria' || pathname.startsWith('/dashboard/cleria/');
  const isMaster = pathname === '/master' || pathname.startsWith('/master/');

  if (pathname === '/login' || pathname === '/onboarding') {
    return <>{children}</>;
  }

  if (isMaster) {
    return (
      <div className="flex h-screen bg-slate-950">
        <MasterSidebar isOpen={isMasterSidebarOpen} setOpen={setMasterSidebarOpen} />
        <div className="flex-1 p-4">
          <main className="w-full h-full bg-slate-50 rounded-2xl p-8 overflow-y-auto">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-blue-600">
      <Sidebar isOpen={isSidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 py-4 pr-4">
        {isClerIA ? (
          <main className="h-full w-full overflow-hidden rounded-l-2xl rounded-r-2xl bg-gray-50">
            {children}
          </main>
        ) : (
          <main className="h-full w-full overflow-y-auto rounded-l-2xl rounded-r-2xl bg-gray-50 p-8">
            {children}
          </main>
        )}
      </div>
    </div>
  );
};

export default LayoutWrapper;
