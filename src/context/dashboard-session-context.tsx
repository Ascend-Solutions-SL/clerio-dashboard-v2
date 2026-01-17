"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

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

  const touchAuthActivity = useCallback(async () => {
    try {
      await fetch('/api/auth/touch', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // ignore
    }
  }, []);

  const throttledTouch = useMemo(() => {
    let last = 0;
    return () => {
      const now = Date.now();
      if (now - last < 30_000) {
        return;
      }
      last = now;
      void touchAuthActivity();
    };
  }, [touchAuthActivity]);

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

      throttledTouch();

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
  }, [throttledTouch]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      void loadSession();
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [loadSession]);

  useEffect(() => {
    if (pathname === '/login' || pathname === '/onboarding') {
      setUser(null);
      setIsLoading(false);
      return;
    }
    void loadSession();
  }, [loadSession, pathname]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (pathname === '/login' || pathname === '/onboarding') {
      return;
    }

    const handler = () => throttledTouch();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        throttledTouch();
      }
    };

    window.addEventListener('click', handler, { passive: true });
    window.addEventListener('keydown', handler);
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('mousemove', handler, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    const interval = window.setInterval(() => {
      throttledTouch();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('scroll', handler);
      window.removeEventListener('mousemove', handler);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [pathname, throttledTouch, user]);

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
