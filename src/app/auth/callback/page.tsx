'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { ENV, assertEnv } from '@/lib/config';

assertEnv();

const resolveLoginUrl = () => ENV.APP_BASE_URL || process.env.CLERIO_LOGIN_URL || 'https://clerio-login.vercel.app';
const resolveDashboardBaseUrl = () => ENV.DASHBOARD_BASE_URL || 'https://dashboard.ascendsolutions.es';

type VerificationState = 'idle' | 'verifying' | 'success' | 'error';

const LoadingScreen = () => (
  <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-slate-900/70 backdrop-blur rounded-2xl border border-slate-800 shadow-xl p-8">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold">Accede a tu cuenta</h1>
        <p className="text-sm text-slate-400">Usa tus credenciales para entrar en Clerio</p>
      </header>

      <form className="mt-8 space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300" htmlFor="email-dummy">
            Correo electrónico
          </label>
          <input
            id="email-dummy"
            type="email"
            disabled
            value=""
            placeholder="nombre@empresa.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 cursor-not-allowed"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300" htmlFor="password-dummy">
            Contraseña
          </label>
          <input
            id="password-dummy"
            type="password"
            disabled
            value=""
            placeholder="Introduce la Contraseña"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 cursor-not-allowed"
          />
        </div>

        <button
          type="button"
          disabled
          className="w-full rounded-lg bg-blue-500 px-4 py-2 text-base font-semibold text-white cursor-not-allowed opacity-60"
        >
          <span className="flex items-center justify-center gap-2">
            <span className="h-5 w-5 rounded-full border-2 border-white/50 border-t-white animate-spin" />
            Validando acceso…
          </span>
        </button>
      </form>

      <footer className="mt-6 text-center text-sm text-slate-400">
        <span>¿No tienes cuenta? </span>
        <span className="font-semibold text-blue-400">Crea una ahora</span>
      </footer>
    </div>
  </main>
);

function AuthCallbackVerifier() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerificationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = searchParams.get('token');
  const target = searchParams.get('redirect') ?? resolveDashboardBaseUrl();
  const loginUrl = useMemo(resolveLoginUrl, []);

  useEffect(() => {
    if (!token) {
      router.replace(loginUrl);
      return;
    }

    const verify = async () => {
      setState('verifying');

      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          const reason = payload.error ?? 'El token recibido es inválido o ha caducado. Vuelve a iniciar sesión.';
          setErrorMessage(reason);
          setState('error');
          return;
        }

        setState('success');
        router.replace(target);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Error desconocido';
        setErrorMessage(reason);
        setState('error');
      }
    };

    void verify();
  }, [loginUrl, router, target, token]);

  if (state === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center space-y-4">
          <h1 className="text-2xl font-semibold">No se pudo validar tu acceso</h1>
          <p className="text-sm text-red-200">
            {errorMessage ?? 'El token recibido es inválido o ha caducado. Vuelve a iniciar sesión.'}
          </p>
          <Link
            href={loginUrl}
            className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
          >
            Volver al login
          </Link>
        </div>
      </main>
    );
  }

  return <LoadingScreen />;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthCallbackVerifier />
    </Suspense>
  );
}
