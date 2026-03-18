"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import type { SessionUser } from '@/lib/session';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

interface DashboardSessionState {
  user: SessionUser | null;
  isLoading: boolean;
  error: string | null;
  isSessionExpired: boolean;
  refresh: () => Promise<void>;
  redirectToLogin: () => void;
}

const DashboardSessionContext = createContext<DashboardSessionState | undefined>(undefined);

const DashboardSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const redirectInFlightRef = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);

  const markSessionExpired = useCallback(() => {
    setUser(null);
    setIsLoading(false);
    setIsSessionExpired(true);
  }, []);

  const redirectToLogin = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (redirectInFlightRef.current) {
      return;
    }
    redirectInFlightRef.current = true;

    const redirect = `${window.location.pathname}${window.location.search}`;
    const url = new URL('/login', window.location.origin);
    if (redirect !== '/') {
      url.searchParams.set('redirect', redirect);
    }
    url.searchParams.set('reason', 'expired');

    const root = document.documentElement;
    const body = document.body;
    root.style.setProperty('overflow', 'hidden');
    body.style.transition = 'opacity 180ms ease, filter 220ms ease';
    body.style.opacity = '0.72';
    body.style.filter = 'blur(1.5px)';

    redirectTimeoutRef.current = window.setTimeout(() => {
      window.location.assign(url.toString());
    }, 170);
  }, []);

  const touchAuthActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/touch', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (res.redirected && res.url.includes('/login')) {
        redirectToLogin();
      }
    } catch {
      // ignore
    }
  }, [redirectToLogin]);

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
        if (pathname !== '/login' && pathname !== '/onboarding') {
          setIsSessionExpired(true);
        }
        return;
      }

      setIsSessionExpired(false);

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

      const reasonLower = reason.toLowerCase();
      if (
        pathname !== '/login' &&
        pathname !== '/onboarding' &&
        (reasonLower.includes('unauthorized') ||
          reasonLower.includes('invalid refresh token') ||
          reasonLower.includes('refresh token') ||
          reasonLower.includes('jwt') ||
          reasonLower.includes('token'))
      ) {
        setIsSessionExpired(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [pathname, throttledTouch]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current != null) {
        window.clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!session?.user) {
        if (pathname !== '/login' && pathname !== '/onboarding') {
          markSessionExpired();
        } else {
          setUser(null);
        }
        return;
      }
      setIsSessionExpired(false);
      void loadSession();
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [loadSession, markSessionExpired, pathname]);

  useEffect(() => {
    if (pathname === '/login' || pathname === '/onboarding') {
      setUser(null);
      setIsLoading(false);
      setIsSessionExpired(false);
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
      isSessionExpired,
      refresh: loadSession,
      redirectToLogin,
    }),
    [error, isLoading, isSessionExpired, loadSession, redirectToLogin, user]
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
