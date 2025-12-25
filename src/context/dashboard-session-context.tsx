"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import type { SessionUser } from '@/lib/session';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

interface DashboardSessionState {
  user: SessionUser | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

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
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setUser(null);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .schema('public')
        .from('auth_users')
        .select(
          'first_name, last_name, user_initials, user_businessname, user_phone, user_email, user_role, empresa_id'
        )
        .eq('user_uid', user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      setUser({
        id: user.id,
        email: profile?.user_email ?? user.email ?? '',
        firstName: profile?.first_name ?? '',
        lastName: profile?.last_name ?? '',
        initials: profile?.user_initials ?? '',
        businessName: profile?.user_businessname ?? '',
        empresaId: profile?.empresa_id ?? null,
        role: profile?.user_role ?? '',
        phone: profile?.user_phone ?? '',
      });
    } catch (fetchError) {
      const reason = fetchError instanceof Error ? fetchError.message : 'Error desconocido';
      setError(reason);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pathname === '/login' || pathname === '/onboarding') {
      setIsLoading(false);
      return;
    }
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
