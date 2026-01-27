"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { assertEnv } from '@/lib/config';
import { ENV } from '@/lib/config';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type AuthMode = 'login' | 'register';

const buildUserInitials = (firstName: string, lastName: string) => {
  const firstInitial = firstName.trim().charAt(0) ?? '';
  const lastInitial = lastName.trim().charAt(0) ?? '';

  return `${firstInitial}${lastInitial}`.toUpperCase();
};

assertEnv();

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const reason = useMemo(() => searchParams.get('reason'), [searchParams]);

  const redirectPath = useMemo(() => {
    const redirect = searchParams.get('redirect');
    if (!redirect) {
      return '/dashboard';
    }

    if (!redirect.startsWith('/')) {
      return '/dashboard';
    }

    return redirect;
  }, [searchParams]);

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessCif, setBusinessCif] = useState('');
  const [accountType, setAccountType] = useState<'empresa' | 'asesoria'>('empresa');
  const [isLoading, setIsLoading] = useState(false);
  const [isMasterEmail, setIsMasterEmail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailRedirectTo = useMemo(() => {
    if (!ENV.APP_BASE_URL) {
      return '';
    }
    const url = new URL('/auth/confirm', ENV.APP_BASE_URL);
    url.searchParams.set('redirect', isMasterEmail ? '/master' : '/onboarding');
    return url.toString();
  }, [isMasterEmail]);

  useEffect(() => {
    if (reason !== 'expired') {
      return;
    }

    const clear = async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      await fetch('/api/auth/touch', { method: 'DELETE', credentials: 'include' });
    };

    void clear();
  }, [reason]);

  useEffect(() => {
    const check = async () => {
      const normalized = email.trim().toLowerCase();
      if (!normalized) {
        setIsMasterEmail(false);
        return;
      }

      try {
        const res = await fetch('/api/public/is-master-email', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: normalized }),
        });

        const payload = (await res.json().catch(() => ({}))) as { isMaster?: boolean };
        setIsMasterEmail(res.ok && payload.isMaster === true);
      } catch {
        setIsMasterEmail(false);
      }
    };

    void check();
  }, [email, mode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        return;
      }

      if (!firstName.trim() || !lastName.trim() || (!isMasterEmail && (!businessName.trim() || !businessCif.trim()))) {
        setError('Completa nombre, apellidos, empresa y CIF');
        return;
      }
    }

    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === 'login') {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        if (!data.session) {
          setMessage('Sesión iniciada. Revisa tu correo para confirmar el acceso.');
          return;
        }

        if (isMasterEmail) {
          router.replace('/master');
          return;
        }

        router.replace(redirectPath);
        return;
      }

      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const trimmedBusiness = businessName.trim();
      const trimmedCif = businessCif.trim();
      const userInitials = buildUserInitials(trimmedFirstName, trimmedLastName);

      const resolvedBusinessName = isMasterEmail ? 'Master' : trimmedBusiness;
      const resolvedCif = isMasterEmail
        ? `MASTER-${email.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'DEFAULT'}`
        : trimmedCif;
      const resolvedAccountType: 'empresa' | 'asesoria' = isMasterEmail ? 'empresa' : accountType;

      if (!isMasterEmail) {
        const cifCheck = await fetch('/api/public/check-cif', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cif: resolvedCif }),
        });

        if (cifCheck.status === 409) {
          setError('Ya existe una cuenta con ese CIF. Si es tu empresa, contacta con soporte.');
          return;
        }

        if (!cifCheck.ok) {
          setError('No se pudo validar el CIF. Inténtalo de nuevo.');
          return;
        }
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: {
            email,
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            user_initials: userInitials,
            user_businessname: resolvedBusinessName,
            user_business_cif: resolvedCif,
            user_phone: '',
            phone: '',
            user_businesstype: resolvedAccountType,
            email_verified: false,
            phone_verified: false,
          },
        },
      });

      if (signUpError) {
        const msg = (signUpError as { message?: string }).message ?? '';
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
          setError('Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.');
          return;
        }
        throw signUpError;
      }

      if (data.user) {
        const identities = (data.user as { identities?: unknown[] }).identities;
        if (Array.isArray(identities) && identities.length === 0) {
          setError('Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.');
          return;
        }
      }

      if (data.user && !data.session) {
        setMessage('Cuenta creada. Revisa tu correo para confirmar antes de iniciar sesión.');
        return;
      }

      router.replace(isMasterEmail ? '/master' : redirectPath);
    } catch (authError) {
      const authMessage = authError instanceof Error ? authError.message : 'Error desconocido';
      setError(authMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div
        className={`w-full bg-slate-900/70 backdrop-blur border border-slate-800 shadow-xl ${
          mode === 'login' ? 'max-w-md rounded-2xl p-8' : 'max-w-3xl rounded-3xl p-10'
        }`}
      >
        <header className="space-y-2 text-center">
          <h1 className="text-[23px] font-semibold leading-tight md:text-[24px]">
            {mode === 'login' ? 'Accede a tu cuenta' : 'Crea una cuenta'}
          </h1>
          <p className="text-sm text-slate-400 md:text-[15px] leading-snug">
            Usa tus credenciales para entrar en Clerio
          </p>
        </header>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {mode === 'login' ? (
            <>
              <div className="space-y-2 w-full max-w-md mx-auto">
                <label className="block text-sm font-medium text-slate-300" htmlFor="email">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="nombre@empresa.com"
                />
              </div>

              <div className="space-y-2 w-full max-w-md mx-auto">
                <label className="block text-sm font-medium text-slate-300" htmlFor="password">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Introduce la Contraseña"
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 place-items-center">
              <div className="space-y-2 w-full max-w-sm">
                <label className="block text-sm font-medium text-slate-300" htmlFor="email">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="nombre@empresa.com"
                />
              </div>

              {!isMasterEmail ? (
                <>
                  <div className="space-y-2 w-full max-w-sm">
                    <label className="block text-sm font-medium text-slate-300" htmlFor="businessName">
                      Nombre de empresa
                    </label>
                    <input
                      id="businessName"
                      type="text"
                      required
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Empresa SL"
                    />
                  </div>

                  <div className="space-y-2 w-full max-w-sm">
                    <label className="block text-sm font-medium text-slate-300" htmlFor="businessCif">
                      CIF
                    </label>
                    <input
                      id="businessCif"
                      type="text"
                      required
                      value={businessCif}
                      onChange={(event) => setBusinessCif(event.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="B12345678"
                    />
                  </div>
                </>
              ) : null}

              <div className="space-y-2 w-full max-w-sm">
                <label className="block text-sm font-medium text-slate-300" htmlFor="firstName">
                  Nombre
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan"
                />
              </div>

              <div className="space-y-2 w-full max-w-sm">
                <label className="block text-sm font-medium text-slate-300" htmlFor="lastName">
                  Apellidos
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Martín González"
                />
              </div>

              <div className="space-y-2 w-full max-w-sm">
                <label className="block text-sm font-medium text-slate-300" htmlFor="password">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Introduce la Contraseña"
                />
              </div>

              <div className="space-y-2 w-full max-w-sm">
                <label
                  className="block text-sm font-medium text-slate-300"
                  htmlFor="confirmPassword"
                >
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Repite la contraseña"
                />
              </div>

              {!isMasterEmail ? (
                <div className="md:col-span-2 flex flex-col items-center space-y-2 w-full">
                  <span className="text-center text-sm font-medium text-slate-300">Tipo de cuenta</span>
                  <input type="hidden" name="accountType" value={accountType} />
                  <div className="w-full max-w-sm relative rounded-2xl border border-slate-700 bg-slate-900 p-1">
                    <div
                      className="absolute inset-y-1 w-1/2 rounded-xl bg-blue-500/20 transition-transform duration-300 ease-out"
                      style={{
                        transform: accountType === 'empresa' ? 'translateX(0)' : 'translateX(100%)',
                      }}
                    />
                    <div className="relative grid grid-cols-2 gap-1 text-sm font-semibold text-slate-300">
                      {[
                        { value: 'empresa' as const, label: 'Empresa', helper: 'Negocios que usan Clerio' },
                        { value: 'asesoria' as const, label: 'Asesoría', helper: 'Despachos y gestorías' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAccountType(option.value)}
                          className={`flex flex-col items-center rounded-xl px-3 py-3 transition ${
                            accountType === option.value
                              ? 'text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span>{option.label}</span>
                          <span className="text-xs font-normal text-slate-400">{option.helper}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {error ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {message ? (
            <div className="flex justify-center">
              <p className="inline-flex rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 text-center shadow-sm">
                {message}
              </p>
            </div>
          ) : null}

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full max-w-md rounded-lg bg-blue-500 px-4 py-2 text-base font-semibold text-white transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading
                ? 'Procesando...'
                : mode === 'login'
                  ? 'Iniciar sesión'
                  : 'Crear cuenta'}
            </button>
          </div>
        </form>

        <footer className="mt-6 text-center text-sm text-slate-400">
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya estás registrado?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
              setMessage(null);
              setFirstName('');
              setLastName('');
              setBusinessName('');
              setBusinessCif('');
              setConfirmPassword('');
            }}
            className="font-semibold text-blue-400 hover:text-blue-300"
          >
            {mode === 'login' ? 'Crea una ahora' : 'Inicia sesión'}
          </button>
        </footer>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
