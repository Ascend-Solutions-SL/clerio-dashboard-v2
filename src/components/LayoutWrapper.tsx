'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import MasterSidebar from './MasterSidebar';
import { useDashboardSession } from '@/context/dashboard-session-context';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

type VisualScaleLevel = 'muy_grande' | 'grande' | 'normal' | 'pequeno' | 'muy_pequeno';

const VISUAL_SCALE_KEY = 'dashboard-visual-scale-level';

const DASHBOARD_SCALE_CLASS_BY_LEVEL: Record<VisualScaleLevel, string> = {
  muy_grande: '[zoom:0.96]',
  grande: '[zoom:0.92]',
  normal: '[zoom:0.88]',
  pequeno: '[zoom:0.84]',
  muy_pequeno: '[zoom:0.80]',
};

const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ children }) => {
  const pathname = usePathname();
  const { isSessionExpired, redirectToLogin } = useDashboardSession();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMasterSidebarOpen, setMasterSidebarOpen] = useState(false);
  const [visualScaleLevel, setVisualScaleLevel] = useState<VisualScaleLevel>('normal');
  const isClerIA = pathname === '/dashboard/cleria' || pathname.startsWith('/dashboard/cleria/');
  const isMaster = pathname === '/master' || pathname.startsWith('/master/');
  const dashboardScaleClass = DASHBOARD_SCALE_CLASS_BY_LEVEL[visualScaleLevel] ?? DASHBOARD_SCALE_CLASS_BY_LEVEL.normal;

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const applySavedScale = () => {
      const raw = window.localStorage.getItem(VISUAL_SCALE_KEY) as VisualScaleLevel | null;
      if (!raw) {
        setVisualScaleLevel('normal');
        return;
      }
      if (raw in DASHBOARD_SCALE_CLASS_BY_LEVEL) {
        setVisualScaleLevel(raw);
      } else {
        setVisualScaleLevel('normal');
      }
    };

    const onScaleChanged = () => applySavedScale();
    window.addEventListener('dashboard-visual-scale-changed', onScaleChanged);
    applySavedScale();

    return () => {
      window.removeEventListener('dashboard-visual-scale-changed', onScaleChanged);
    };
  }, []);

  if (pathname === '/login' || pathname === '/onboarding') {
    return <>{children}</>;
  }

  if (isMaster) {
    return (
      <div className="flex h-screen bg-slate-950 font-[family-name:var(--font-geist-sans)]">
        <MasterSidebar isOpen={isMasterSidebarOpen} setOpen={setMasterSidebarOpen} />
        <div className="relative flex-1 p-4">
          <main
            className={`w-full h-full bg-slate-50 rounded-2xl p-8 overflow-y-auto transition-[filter,opacity] duration-300 ${
              isSessionExpired ? 'pointer-events-none select-none blur-[2px] opacity-80' : ''
            }`}
          >
            {children}
          </main>
          {isSessionExpired ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/96 p-6 text-center shadow-[0_25px_70px_rgba(15,23,42,0.2)] backdrop-blur-sm">
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-slate-900">Sesión caducada</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Tu sesión ha caducado. Para seguir usando Clerio, inicia sesión de nuevo.
                </p>
                <button
                  type="button"
                  onClick={redirectToLogin}
                  className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Ir a login
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-blue-600 font-[family-name:var(--font-geist-sans)]">
      <Sidebar isOpen={isSidebarOpen} setOpen={setSidebarOpen} />
      <div className="relative flex-1 py-4 pl-0 pr-5">
        {isClerIA ? (
          <main
            className={`h-full w-full overflow-hidden rounded-l-2xl rounded-r-2xl bg-gray-50 transition-[filter,opacity] duration-300 ${
              isSessionExpired ? 'pointer-events-none select-none blur-[2px] opacity-80' : ''
            }`}
          >
            <div className="h-full w-full">{children}</div>
          </main>
        ) : (
          <main
            className={`h-full w-full overflow-y-auto rounded-l-2xl rounded-r-2xl bg-gray-50 p-8 transition-[filter,opacity] duration-300 ${
              isSessionExpired ? 'pointer-events-none select-none blur-[2px] opacity-80' : ''
            }`}
          >
            <div className={`min-h-full ${dashboardScaleClass}`}>{children}</div>
          </main>
        )}
        {isSessionExpired ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/96 p-6 text-center shadow-[0_25px_70px_rgba(15,23,42,0.2)] backdrop-blur-sm">
              <h2 className="text-lg font-semibold tracking-[-0.01em] text-slate-900">Sesión caducada</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Tu sesión ha caducado. Para seguir usando Clerio, inicia sesión de nuevo.
              </p>
              <button
                type="button"
                onClick={redirectToLogin}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Ir a login
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LayoutWrapper;
