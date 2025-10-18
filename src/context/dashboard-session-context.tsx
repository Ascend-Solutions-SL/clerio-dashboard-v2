"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { SessionUser } from '@/lib/session';

interface DashboardSessionState {
  user: SessionUser | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL ?? 'https://clerio-login.vercel.app';

const DashboardSessionContext = createContext<DashboardSessionState | undefined>(undefined);

const DashboardSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = LOGIN_URL;
        return;
      }

      if (!response.ok) {
        throw new Error('No se pudo recuperar la sesión');
      }

      const payload = (await response.json()) as { user: SessionUser };
      setUser(payload.user);
    } catch (fetchError) {
      const reason = fetchError instanceof Error ? fetchError.message : 'Error desconocido';
      setError(reason);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const value = useMemo<DashboardSessionState>(
    () => ({
      user,
      isLoading,
      error,
      refresh: loadSession,
    }),
    [error, isLoading, loadSession, user]
  );

  return <DashboardSessionContext.Provider value={value}>{children}</DashboardSessionContext.Provider>;
};

const useDashboardSession = () => {
  const context = useContext(DashboardSessionContext);

  if (!context) {
    throw new Error('useDashboardSession debe usarse dentro de DashboardSessionProvider');
  }

  return context;
};

export { DashboardSessionProvider, useDashboardSession };
