"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import type { SessionUser } from '@/lib/session';
import { supabase } from '@/lib/supabase';

interface DashboardSessionState {
  user: SessionUser | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

import { ENV, assertEnv } from '@/lib/config';

const LOGIN_URL = ENV.APP_BASE_URL;

assertEnv();

const DashboardSessionContext = createContext<DashboardSessionState | undefined>(undefined);

const DashboardSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
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
        const { origin, pathname } = window.location;
        const isAuthFlow = pathname.startsWith('/auth/');

        if (origin !== LOGIN_URL && !isAuthFlow) {
          window.location.href = LOGIN_URL;
        }
        return;
      }

      if (!response.ok) {
        throw new Error('No se pudo recuperar la sesión');
      }

      const payload = (await response.json()) as { user: SessionUser };
      const userData = { ...payload.user };

      if (!userData.role && userData.id) {
        const { data: profile } = await supabase
          .from('auth_users')
          .select('user_role')
          .eq('user_uid', userData.id)
          .single();

        if (profile?.user_role) {
          userData.role = profile.user_role;
        }
      }

      setUser(userData);
    } catch (fetchError) {
      const reason = fetchError instanceof Error ? fetchError.message : 'Error desconocido';
      setError(reason);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession, pathname]);

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
