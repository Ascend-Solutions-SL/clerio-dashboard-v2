'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { assertEnv } from '@/lib/config';

assertEnv();

const resolveLoginUrl = () => '/login';

type VerificationState = 'idle' | 'verifying' | 'success' | 'error';

const LoadingScreen = () => (
  <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
    <div className="w-full max-w-md rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Validando acceso…</h1>
      <p className="text-sm text-blue-200">
        Estamos comprobando tus credenciales, un momento por favor.
      </p>
    </div>
  </main>
);

function AuthCallbackVerifier() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerificationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = searchParams.get('token');
  const target = searchParams.get('redirect') ?? '/dashboard';
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
