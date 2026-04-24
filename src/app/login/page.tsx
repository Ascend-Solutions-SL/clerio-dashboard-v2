"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
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

const LOGIN_DASHBOARD_MOCK_BASE_WIDTH = 760;
const LOGIN_DASHBOARD_MOCK_BASE_HEIGHT = (LOGIN_DASHBOARD_MOCK_BASE_WIDTH * 9) / 16;
const LOGIN_DASHBOARD_MOCK_MAX_SCALE = 1.4;

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
  const [showSessionExpiredNotice, setShowSessionExpiredNotice] = useState(false);
  const dashboardMockScaleHostRef = useRef<HTMLDivElement | null>(null);
  const [dashboardMockScale, setDashboardMockScale] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const host = dashboardMockScaleHostRef.current;
    if (!host) {
      return;
    }

    const updateScale = () => {
      const availableWidth = host.clientWidth;
      if (!availableWidth) {
        return;
      }

      const rawScale = availableWidth / LOGIN_DASHBOARD_MOCK_BASE_WIDTH;
      const nextScale = Math.min(Math.max(rawScale, 1), LOGIN_DASHBOARD_MOCK_MAX_SCALE);
      setDashboardMockScale((prev) => (Math.abs(prev - nextScale) < 0.01 ? prev : nextScale));
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });

    resizeObserver.observe(host);
    window.addEventListener('resize', updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

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
      setShowSessionExpiredNotice(false);
      return;
    }

    setShowSessionExpiredNotice(true);

    const clear = async () => {
      await fetch('/api/auth/touch', { method: 'DELETE', credentials: 'include' });
    };

    const hideNoticeTimeout = window.setTimeout(() => {
      setShowSessionExpiredNotice(false);
    }, 3800);

    void clear();

    return () => {
      window.clearTimeout(hideNoticeTimeout);
    };
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
      {showSessionExpiredNotice ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-center shadow-[0_10px_30px_rgba(16,185,129,0.18)] backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="text-sm font-semibold text-emerald-800">Tu sesión ha caducado</div>
            <div className="mt-1 text-xs text-emerald-700">Por seguridad, vuelve a iniciar sesión para continuar.</div>
          </div>
        </div>
      ) : null}

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

          {mode === 'login' ? (
            <div className="flex items-center gap-2 w-full mt-3 mb-0.5">
              <div className="flex-1 h-px bg-gray-200" />
              <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          ) : null}

          {/* Form */}
          <form className={`w-full ${mode === 'login' ? 'space-y-3 mt-2' : 'space-y-3 mt-4'}`} onSubmit={handleSubmit}>
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

        {/* Dashboard mock (estética Inicio Clerio) */}
        <div className="relative z-10 flex-1 flex items-start justify-center mt-25 px-2">
          <div
            ref={dashboardMockScaleHostRef}
            className="w-full flex justify-center"
            style={{ height: `${LOGIN_DASHBOARD_MOCK_BASE_HEIGHT * dashboardMockScale}px` }}
          >
            <div
              className="overflow-hidden rounded-xl border-[4px] border-blue-600 bg-blue-600 will-change-transform"
              style={{
                width: `${LOGIN_DASHBOARD_MOCK_BASE_WIDTH}px`,
                height: `${LOGIN_DASHBOARD_MOCK_BASE_HEIGHT}px`,
                transform: `scale(${dashboardMockScale})`,
                transformOrigin: 'top center',
              }}
            >
              <div className="flex h-full">
                <aside className="w-[17%] bg-blue-600 text-white flex flex-col">
                  <div className="h-10 px-2 flex items-center border-b border-white/20">
                    <img src="/brand/IMAGO_BLANCO.png" alt="Clerio" className="h-4 w-4 object-contain" />
                    <span className="ml-1.5 text-[10px] font-bold tracking-wide">Clerio</span>
                  </div>

                  <div className="pt-1.5 space-y-0.5">
                    {[
                      { label: 'Inicio', icon: '/sidebar/inicio_logo.png' },
                      { label: 'Ingresos', icon: '/sidebar/ingresos_logo.png' },
                      { label: 'Gastos', icon: '/sidebar/gastos_logo.png' },
                      { label: 'Validación', icon: '/brand/tab_validacion/validacion_logo.png' },
                      { label: 'Integraciones', icon: '/sidebar/integraciones_logo.png' },
                      { label: 'Cler IA', icon: '/brand/tab_cleria/cleria_logo.png' },
                    ].map((item, index) => (
                      <div
                        key={item.label}
                        className={`px-2 h-[22px] flex items-center text-[8px] ${
                          index === 0 ? 'bg-blue-700 font-semibold' : 'text-blue-100'
                        }`}
                      >
                        <img src={item.icon} alt={item.label} className="h-3 w-3 object-contain mr-1.5" />
                        {item.label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto px-2 py-2 border-t border-white/20 flex items-center gap-1.5">
                    <div className="h-4.5 w-4.5 rounded-full bg-blue-500 border border-white/70 flex items-center justify-center text-[7px] font-semibold">
                      VT
                    </div>
                    <div>
                      <p className="text-[8px] font-semibold leading-none">Victor Torres</p>
                      <p className="text-[7px] text-blue-200 mt-0.5">Administrador</p>
                    </div>
                  </div>
                </aside>

                <main className="w-[83%] bg-gray-50 px-2.5 pt-2.5 pb-1 overflow-hidden">
                  <div className="h-full rounded-lg bg-gray-50">
                    <div className="mb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[7px] text-gray-500">
                            Hola Victor! Tienes <span className="font-semibold text-blue-600">7</span> facturas pendientes de validar.
                          </p>
                          <p className="text-[13px] font-bold text-gray-800 leading-tight">Dashboard de Victor Torres</p>
                          <p className="text-[7px] text-gray-400">victor.torres@empresa-demo.com</p>
                        </div>
                        <div className="h-5 rounded-md border border-gray-200 bg-white px-1.5 flex items-center text-[7px] text-gray-500">
                          01/04/2025 - 30/06/2025
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-2.5 px-2.5 py-1">
                      <div className="w-[24%] rounded-xl border border-gray-200 bg-white pl-2.5 pr-1 py-1 h-11">
                        <p className="text-[8px] text-gray-500">Facturas Procesadas</p>
                        <p className="text-[10px] font-semibold text-gray-900 mt-0.5">184</p>
                      </div>
                      <div className="w-[24%] rounded-xl border border-gray-200 bg-white pl-2.5 pr-1 py-1 h-11">
                        <p className="text-[8px] text-gray-500">Ingresos</p>
                        <p className="text-[10px] font-semibold text-gray-900 mt-0.5">42.680,00€</p>
                      </div>
                      <div className="w-[24%] rounded-xl border border-gray-200 bg-white pl-2.5 pr-1 py-1 h-11">
                        <p className="text-[8px] text-gray-500">Gastos</p>
                        <p className="text-[10px] font-semibold text-gray-900 mt-0.5">19.430,00€</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7 min-h-[204px] rounded-lg border border-gray-200 bg-white p-2 pb-3">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <p className="text-[9px] font-semibold text-gray-800">Datos mensuales</p>
                            <p className="text-[7px] text-gray-400">Resumen de ingresos y gastos mensuales</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1">
                            <button type="button" className="rounded-[4px] border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[7px] font-semibold text-blue-600">
                              Ingresos
                            </button>
                            <button type="button" className="rounded-[4px] border border-transparent bg-transparent px-1.5 py-0.5 text-[7px] font-semibold text-gray-400">
                              Gastos
                            </button>
                          </div>
                          <p className="text-[7px] text-gray-400">2025</p>
                        </div>

                        <div className="relative h-[132px]">
                          <div className="absolute left-0 top-0 bottom-4 w-8 flex flex-col justify-between text-[6px] text-gray-400">
                            <span>7.500 €</span>
                            <span>5.000 €</span>
                            <span>2.500 €</span>
                            <span>0 €</span>
                          </div>
                          <div className="absolute left-8 right-0 top-0 bottom-4">
                            <div className="h-full flex flex-col justify-between">
                              {[0, 1, 2, 3].map((line) => (
                                <div key={`grid-${line}`} className="border-t border-dashed border-gray-200" />
                              ))}
                            </div>
                          </div>
                          <div className="absolute left-8 right-0 bottom-4 top-1 flex items-end gap-1">
                            {[78, 36, 84, 28, 69, 41, 74, 33, 66, 82, 45, 71].map((value, idx) => (
                              <div key={`bar-${idx}`} className="flex-1 rounded-t-[2px] bg-emerald-500" style={{ height: `${value}%` }} />
                            ))}
                          </div>
                          <div className="absolute left-8 right-0 bottom-0 flex justify-between text-[6px] text-gray-400">
                            {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((month) => (
                              <span key={month}>{month}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-5 min-h-[204px] rounded-lg border border-gray-200 bg-white p-2 pb-3">
                        <div className="mb-1.5 flex items-center justify-between pr-1">
                          <p className="text-[9px] font-semibold text-gray-800">ClerIA</p>
                          <p className="text-[7px] text-blue-600 text-right">Abrir</p>
                        </div>
                        <div className="space-y-0.5 pr-1">
                          {[
                            ['Consulta de factura F250021', '02/04/2025'],
                            ['Ingresos anuales: ¿cuánto tengo?', '02/04/2025'],
                            ['Consulta de facturas anuales', '30/03/2025'],
                            ['Presupuesto de Fotografía y Edición', '30/03/2025'],
                            ['Gastos del 2025: Consulta rápida', '30/03/2025'],
                            ['Facturación y consultas generales', '29/03/2025'],
                            ['Factura de gastos: VAS MOTOR', '29/03/2025'],
                            ['Gastos de agosto 2025', '27/03/2025'],
                          ].map(([title, date]) => (
                            <div key={`${title}-${date}`} className="flex items-center justify-between gap-1 rounded-md px-1 py-0.5">
                              <span className="text-[6.5px] text-gray-700 truncate">{title}</span>
                              <span className="text-[6px] text-gray-400 shrink-0">{date}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </main>
              </div>
            </div>
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
