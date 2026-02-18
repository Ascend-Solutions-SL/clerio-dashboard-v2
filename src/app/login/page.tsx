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

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const normalizeTitleCase = (value: string) => {
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return '';

  return cleaned
    .split(/\s+/)
    .map((word) => {
      const initial = word.charAt(0);
      return initial ? `${initial.toUpperCase()}${word.slice(1)}` : '';
    })
    .join(' ');
};

const normalizeCif = (value: string) => value.trim().toUpperCase();

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
  const [emailChecked, setEmailChecked] = useState(false);

  const emailRedirectTo = useMemo(() => {
    if (!ENV.APP_BASE_URL) {
      return '';
    }
    const url = new URL('/auth/confirm', ENV.APP_BASE_URL);
    url.searchParams.set('redirect', isMasterEmail ? '/master' : '/onboarding');
    return url.toString();
  }, [isMasterEmail]);

  const checkMasterEmail = async (emailToCheck: string) => {
    const normalized = emailToCheck.trim().toLowerCase();
    if (!normalized) {
      setIsMasterEmail(false);
      setEmailChecked(false);
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
      setEmailChecked(true);
    } catch {
      setIsMasterEmail(false);
      setEmailChecked(true);
    }
  };

  const handleEmailBlur = () => {
    if (!emailChecked) {
      checkMasterEmail(email);
    }
  };

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    setEmailChecked(false); // Reset checked state when email changes
  };

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    // Check master email on submit if not already checked
    if (!emailChecked) {
      await checkMasterEmail(email);
    }

    const normalizedEmail = normalizeEmail(email);

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
          email: normalizedEmail,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        if (!data.session) {
          setMessage('Sesión iniciada. Revisa tu correo para confirmar el acceso.');
          return;
        }

        await fetch('/api/auth/touch', { method: 'POST', credentials: 'include' });

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

      const resolvedFirstName = normalizeTitleCase(trimmedFirstName);
      const resolvedLastName = normalizeTitleCase(trimmedLastName);
      const userInitials = buildUserInitials(resolvedFirstName, resolvedLastName);

      const resolvedBusinessName = isMasterEmail ? 'Master' : trimmedBusiness;
      const resolvedCif = isMasterEmail
        ? `MASTER-${normalizedEmail.replace(/[^a-z0-9]/g, '').slice(0, 16) || 'DEFAULT'}`
        : normalizeCif(trimmedCif);
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
        email: normalizedEmail,
        password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: {
            email: normalizedEmail,
            first_name: resolvedFirstName,
            last_name: resolvedLastName,
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
    <main className="min-h-screen bg-white flex">
      {/* ── Left Panel ── */}
      <div className="w-full lg:w-1/2 flex flex-col relative px-6 pt-2 pb-8 lg:py-8 overflow-y-auto">
        {/* Logo - absolute top left */}
        <div className="pl-2 pt-2 mb-0">
          <img
            src="/brand/main_logo.png"
            alt="Clerio"
            className="h-9 object-contain"
          />
        </div>

        <div className="flex-1 flex flex-col items-center justify-start lg:justify-center pt-20 lg:pt-0">
        <div className="w-full max-w-[340px] flex flex-col items-center">

          {mode === 'login' ? (
            <>
              {/* Welcome heading */}
              <h1 className="text-3xl font-[800] text-gray-900 leading-tight text-center w-full">
                ¡Bienvenido!
              </h1>

              {/* Decorative divider */}
              <div className="flex items-center gap-2 mt-3 mb-4">
                <div className="w-8 h-[2px] bg-blue-500 rounded-full" />
                <div className="w-2 h-2 rounded-full border-2 border-blue-500" />
                <div className="w-8 h-[2px] bg-blue-500 rounded-full" />
              </div>

              {/* Subtitle */}
              <h2 className="text-base font-semibold text-gray-900 text-center">
                Inicia sesión en Clerio
              </h2>
              <p className="text-xs text-gray-400 mt-1 text-center">
                Rellena los siguientes campos para acceder
              </p>
            </>
          ) : (
            <>
              {/* Register heading - larger, no divider */}
              <h2 className="text-3xl font-[800] text-gray-900 leading-tight text-center w-full">
                Regístrate en Clerio
              </h2>
              <p className="text-sm text-gray-400 mt-2 text-center">
                Completa los datos para crear tu cuenta
              </p>
            </>
          )}

          {/* Google button (non-functional) */}
          {mode === 'login' && (
            <>
              <button
                type="button"
                className="mt-5 w-full flex items-center justify-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continua con Google
              </button>

              {/* Separator */}
              <div className="flex items-center gap-3 w-full my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">o</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </>
          )}

          {/* Form */}
          <form className={`w-full ${mode === 'login' ? 'space-y-3' : 'space-y-3 mt-4'}`} onSubmit={handleSubmit}>
            {mode === 'login' ? (
              <>
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700 text-center" htmlFor="email">
                    Correo
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    className="!w-full !rounded-full !border !border-gray-200 !bg-white !px-4 !py-2 !text-sm !text-gray-900 !placeholder:text-gray-400 !shadow-none !text-center focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20"
                    placeholder="Escribe tu correo electrónico"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700 text-center" htmlFor="password">
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
                    className="!w-full !rounded-full !border !border-gray-200 !bg-white !px-4 !py-2 !text-sm !text-gray-900 !placeholder:text-gray-400 !shadow-none !text-center focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20"
                    placeholder="Escribe tu contraseña"
                  />
                </div>

                {/* Forgot password */}
                <div className="text-center pt-1">
                  <button type="button" className="text-xs text-blue-500 hover:text-blue-600 font-medium hover:underline">
                    ¿Has olvidado tu contraseña?
                  </button>
                </div>
              </>
            ) : (
              /* ── Register fields ── */
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700" htmlFor="email">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    className="!w-full !rounded-full !border !border-gray-200 !bg-white !px-4 !py-2 !text-sm !text-gray-900 !placeholder:text-gray-400 !shadow-none focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20"
                    placeholder="nombre@empresa.com"
                  />
                </div>

                {!isMasterEmail ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-gray-700" htmlFor="businessName">
                        Nombre de empresa
                      </label>
                      <input
                        id="businessName"
                        type="text"
                        required
                        value={businessName}
                        onChange={(event) => setBusinessName(event.target.value)}
                        className="!w-full !rounded-full !border !border-gray-200 !bg-white !px-4 !py-2 !text-sm !text-gray-900 !placeholder:text-gray-400 !shadow-none focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20"
                        placeholder="Empresa SL"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-gray-700" htmlFor="businessCif">
                        CIF
                      </label>
                      <input
                        id="businessCif"
                        type="text"
                        required
                        value={businessCif}
                        onChange={(event) => setBusinessCif(event.target.value)}
                        className="!w-full !rounded-full !border !border-gray-200 !bg-white !px-4 !py-2 !text-sm !text-gray-900 !placeholder:text-gray-400 !shadow-none focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20"
                        placeholder="B12345678"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-gray-700" htmlFor="firstName">
                      Nombre
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className="!w-full !rounded-full !border !border-gray-200 !bg-white !px-4 !py-2 !text-sm !text-gray-900 !placeholder:text-gray-400 !shadow-none focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20"
                      placeholder="Juan"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-gray-700" htmlFor="lastName">
                      Apellidos
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className="!w-full !rounded-full !border !border-gray-200 !bg-white !px-4 !py-2 !text-sm !text-gray-900 !placeholder:text-gray-400 !shadow-none focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20"
                      placeholder="Martín González"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700" htmlFor="password">
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
                    className="!w-full !rounded-full !border !border-gray-200 !bg-white !px-4 !py-2 !text-sm !text-gray-900 !placeholder:text-gray-400 !shadow-none focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20"
                    placeholder="Introduce la contraseña"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700" htmlFor="confirmPassword">
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
                    className="!w-full !rounded-full !border !border-gray-200 !bg-white !px-4 !py-2 !text-sm !text-gray-900 !placeholder:text-gray-400 !shadow-none focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20"
                    placeholder="Repite la contraseña"
                  />
                </div>

                {!isMasterEmail ? (
                  <div className="flex flex-col items-center space-y-2 w-full pt-1">
                    <span className="text-xs font-semibold text-gray-700">Tipo de cuenta</span>
                    <input type="hidden" name="accountType" value={accountType} />
                    <div className="w-full relative rounded-full border border-gray-200 bg-gray-50 p-1">
                      <div
                        className="absolute inset-y-1 w-1/2 rounded-full bg-blue-500/10 transition-transform duration-300 ease-out"
                        style={{
                          transform: accountType === 'empresa' ? 'translateX(0)' : 'translateX(100%)',
                        }}
                      />
                      <div className="relative grid grid-cols-2 gap-1 text-sm font-semibold text-gray-600">
                        {[
                          { value: 'empresa' as const, label: 'Empresa', helper: 'Negocios que usan Clerio' },
                          { value: 'asesoria' as const, label: 'Asesoría', helper: 'Despachos y gestorías' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAccountType(option.value)}
                            className={`flex flex-col items-center rounded-full px-3 py-2 transition ${
                              accountType === option.value
                                ? 'text-blue-600'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            <span className="text-xs">{option.label}</span>
                            <span className="text-[10px] font-normal text-gray-400">{option.helper}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Error */}
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            {/* Success message */}
            {message ? (
              <div className="flex justify-center">
                <p className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 text-center shadow-sm">
                  {message}
                </p>
              </div>
            ) : null}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 mt-1"
            >
              {isLoading
                ? 'Procesando...'
                : mode === 'login'
                  ? 'Inicia sesión'
                  : 'Crear cuenta'}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="mt-4 text-center text-xs text-gray-500">
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
              className="font-semibold text-blue-500 hover:text-blue-600"
            >
              {mode === 'login' ? 'Crea una ahora' : 'Inicia sesión'}
            </button>
          </p>
        </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden rounded-l-[2rem] m-3 mr-0 p-8 flex-col" style={{ background: 'linear-gradient(180deg, #2563eb 0%, #3b82f6 30%, #93bbfd 55%, #ffffff 90%)' }}>

        {/* Top content */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-blue-600 mb-4 shadow-sm">
            CLERIO Software de gestión documental
          </div>
          <p className="text-white text-sm leading-relaxed">
            <span className="font-bold">Clerio automatiza tu gestión documental</span>{' '}
            conectando tus herramientas para que las facturas de ingresos y gastos se organicen solas, manteniendo a tu empresa y a tu asesoría siempre al día.
          </p>
        </div>

        {/* Dashboard placeholder */}
        <div className="relative z-10 flex-1 flex items-end justify-center mt-6 px-2">
          <div className="w-full rounded-t-xl bg-white/10 backdrop-blur-sm border border-white/20 border-b-0 flex items-center justify-center" style={{ aspectRatio: '16/11' }}>
            <span className="text-white/30 text-xs font-medium">Vista previa del dashboard</span>
          </div>
        </div>
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
