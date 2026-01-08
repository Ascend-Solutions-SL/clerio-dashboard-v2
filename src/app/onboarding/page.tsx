"use client";

import { Check, ChevronLeft, ChevronRight, Plug } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const steps = [
  { id: 1, label: 'Bienvenida' },
  { id: 2, label: 'Espacio de trabajo' },
  { id: 3, label: 'Integraciones' },
  { id: 4, label: 'Invitación' },
] as const;

type Step = (typeof steps)[number];
type StepId = Step['id'];
const stepOrder: StepId[] = steps.map((step) => step.id);

const reachOptions = [
  { label: 'LinkedIn', tone: '#0077b5', icon: 'in' },
  { label: 'Email', tone: '#1f7aff', icon: '✉️' },
  { label: 'Instagram', tone: '#ff5f6d', icon: 'IG' },
  { label: 'Twitter/X', tone: '#111315', icon: '𝕏' },
  { label: 'Amigos', tone: '#f58f5d', icon: '👥' },
  { label: 'TikTok', tone: '#111111', icon: '♫' },
  { label: 'Internet', tone: '#246bfd', icon: '🌐' },
  { label: 'Otro', tone: '#afb5c6', icon: '…' },
] as const;

const jobRoles = ['CEO / Dirección', 'Finanzas', 'Operaciones', 'Administración', 'Otro'];

const peopleRanges = ['1 - 10 personas', '11 - 50 personas', '51 - 200 personas', '+200 personas'];

const accountingWays = ['Interna', 'Externa con asesoría', 'Mixta', 'Aún no definida'];

type Integration = {
  name: string;
  description: string;
  icon: string;
  color: string;
};

type ProviderOption = {
  value: string;
  label: string;
  description: string;
  icon: string;
  accent: string;
};

const integrations: Integration[] = [
  {
    name: 'Gmail',
    description: 'Conecta tu cuenta de Gmail para que Clerio reciba tus facturas.',
    icon: 'G',
    color: '#ea4335',
  },
  {
    name: 'WhatsApp',
    description: 'Sincroniza tus documentos recibidos por WhatsApp Business.',
    icon: 'W',
    color: '#25d366',
  },
  {
    name: 'Dropbox',
    description: 'Conecta tu drive documental para centralizar todo.',
    icon: 'D',
    color: '#0061ff',
  },
  {
    name: 'One Drive',
    description: 'Sincroniza tus carpetas de One Drive automáticamente.',
    icon: 'O',
    color: '#0078d4',
  },
  {
    name: 'Wolters Kluwer',
    description: 'Recibe facturas emitidas desde Wolters Kluwer.',
    icon: 'WK',
    color: '#47c4a7',
  },
  {
    name: 'Hubspot',
    description: 'Conecta tu CRM para asociar oportunidades a facturas.',
    icon: 'H',
    color: '#ff7a59',
  },
  {
    name: 'Microsoft Teams',
    description: 'Coordina con tu equipo compartiendo documentos al instante.',
    icon: 'T',
    color: '#4b53bc',
  },
  {
    name: 'Google Drive',
    description: 'Sincroniza tus carpetas de Drive y evita duplicados.',
    icon: 'Gd',
    color: '#34a853',
  },
];

const emailProviders: ProviderOption[] = [
  {
    value: 'gmail',
    label: 'Gmail',
    description: 'Google Workspace / G Suite',
    icon: '✉️',
    accent: '#f2615b',
  },
  {
    value: 'outlook',
    label: 'Outlook',
    description: 'Microsoft 365 / Exchange',
    icon: '📬',
    accent: '#2266ff',
  },
  {
    value: 'other-email',
    label: 'Otro',
    description: 'IMAP / proveedor propio',
    icon: '✨',
    accent: '#7b61ff',
  },
];

const storageProviders: ProviderOption[] = [
  {
    value: 'drive',
    label: 'Google Drive',
    description: 'Espacio en la nube de Google',
    icon: '☁️',
    accent: '#34a853',
  },
  {
    value: 'onedrive',
    label: 'OneDrive',
    description: 'Microsoft Cloud',
    icon: '🗂️',
    accent: '#0d6efd',
  },
  {
    value: 'other-storage',
    label: 'Otro',
    description: 'Dropbox, Box, etc.',
    icon: '📦',
    accent: '#ff7a59',
  },
];

export default function ClerioOnboarding() {
  return (
    <Suspense fallback={null}>
      <ClerioOnboardingInner />
    </Suspense>
  );
}

function ClerioOnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeStep, setActiveStep] = useState<StepId>(1);
  const [workspaceBusinessName, setWorkspaceBusinessName] = useState('');
  const [workspaceBusinessNameLocked, setWorkspaceBusinessNameLocked] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('LinkedIn');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [integrationsDone, setIntegrationsDone] = useState(false);
  const [integrationsInitialStage, setIntegrationsInitialStage] = useState<'email' | 'storage' | 'success'>('email');
  const [integrationsAutoAdvanceTo, setIntegrationsAutoAdvanceTo] = useState<'email' | 'storage' | 'success' | null>(null);

  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam === '3') {
      setActiveStep(3);
      setIntegrationsDone(false);
    }

    const stageParam = searchParams.get('integrationStage');
    if (stageParam === 'email' || stageParam === 'storage' || stageParam === 'success') {
      setIntegrationsInitialStage(stageParam);
      setIntegrationsAutoAdvanceTo(null);
      return;
    }

    const fromParam = searchParams.get('integrationFrom');
    const toParam = searchParams.get('integrationTo');
    if (
      (fromParam === 'email' || fromParam === 'storage' || fromParam === 'success') &&
      (toParam === 'email' || toParam === 'storage' || toParam === 'success')
    ) {
      setIntegrationsInitialStage(fromParam);
      setIntegrationsAutoAdvanceTo(toParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadUserDefaults = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return;

      const metadata = data.user.user_metadata as Record<string, unknown>;
      const businessName = typeof metadata.user_businessname === 'string' ? metadata.user_businessname.trim() : '';
      if (!businessName) return;

      setWorkspaceBusinessName(businessName);
      setWorkspaceBusinessNameLocked(true);
    };

    void loadUserDefaults();
  }, []);

  const isFirst = activeStep === 1;
  const isLast = activeStep === steps.length;

  const progress = (activeStep - 1) / (steps.length - 1);

  const handleInviteSend = () => {
    const trimmedEmail = inviteEmail.trim();
    const atIndex = trimmedEmail.indexOf('@');
    const hasAt = atIndex > 0;
    const hasDotAfterAt = hasAt && trimmedEmail.slice(atIndex + 1).includes('.');
    if (!hasAt || !hasDotAfterAt) {
      setInviteMessage('Añade un email válido antes de enviar la invitación.');
      return false;
    }

    setInviteMessage(`La invitación se enviará a ${trimmedEmail}.`);
    return true;
  };

  const finishOnboarding = async () => {
    const response = await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
      const reason =
        typeof payload.error === 'string' ? payload.error : 'No se pudo completar el onboarding. Inténtalo de nuevo.';
      setInviteMessage(reason);
      return;
    }

    router.replace('/dashboard');
  };

  const handleNext = async () => {
    if (isLast) {
      await finishOnboarding();
      return;
    }

    setActiveStep((prev) => {
      const currentIndex = stepOrder.indexOf(prev);
      const nextIndex = Math.min(currentIndex + 1, stepOrder.length - 1);
      const nextStep = stepOrder[nextIndex];
      if (nextStep === 3) {
        setIntegrationsDone(false);
      }
      return nextStep;
    });
  };

  const handlePrevious = () => {
    setActiveStep((prev) => {
      const currentIndex = stepOrder.indexOf(prev);
      const nextIndex = Math.max(currentIndex - 1, 0);
      const nextStep = stepOrder[nextIndex];
      if (nextStep === 3) {
        setIntegrationsDone(false);
      }
      return nextStep;
    });
  };

  const isNextEnabled = activeStep !== 3 || integrationsDone;

  return (
    <main className="onboarding-shell flex min-h-screen w-full flex-col items-center px-3 py-3 md:py-4">
      <div className="w-full max-w-[820px] md:max-w-[900px] xl:max-w-[960px]">
        <header className="relative flex items-center justify-center py-2">
          <div className="absolute left-0 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_6px_24px_rgba(19,64,142,0.22)]">
              <img
                src="/brand/IMAGO_AZUL.png"
                alt="Clerio"
                className="h-auto w-auto rounded-full"
              />
            </div>
            <p className="text-lg font-semibold text-[#091c42]">Clerio</p>
          </div>
          <p className="text-sm font-semibold text-[#6d81a8]">
            Rellena los siguientes campos para configurar tu cuenta
          </p>
        </header>

        <section className="mt-4">
          <Stepper activeStep={activeStep} progress={progress} />
        </section>

        <section className="mt-5 rounded-[22px] bg-gradient-to-br from-white via-white to-[#f3f7ff] p-6 shadow-[0_24px_70px_rgba(14,54,120,0.12)] md:p-7">
          {activeStep === 1 && (
            <DiscoveryStep selectedChannel={selectedChannel} onSelectChannel={setSelectedChannel} />
          )}
          {activeStep === 2 && (
            <WorkspaceStep
              businessName={workspaceBusinessName}
              businessNameLocked={workspaceBusinessNameLocked}
              onBusinessNameChange={setWorkspaceBusinessName}
            />
          )}
          {activeStep === 3 && (
            <IntegrationsStep
              items={integrations}
              initialStage={integrationsInitialStage}
              autoAdvanceTo={integrationsAutoAdvanceTo}
              onComplete={() => setIntegrationsDone(true)}
            />
          )}
          {activeStep === 4 && (
            <InviteStep
              inviteEmail={inviteEmail}
              onChangeEmail={setInviteEmail}
              message={inviteMessage}
              onSend={handleInviteSend}
            />
          )}

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="rounded-xl border border-[#d2dae8] px-6 py-3 text-sm font-semibold text-[#5c6e95] transition hover:border-[#b7c7ea] hover:bg-[#f5f7fb] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handlePrevious}
              disabled={isFirst}
            >
              Anterior
            </button>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {isLast && (
                <button
                  className="rounded-xl px-10 py-3 text-sm font-semibold transition bg-[#f3efe6] text-[#6b5b3a] border border-[#e4ddcf] shadow-[0_16px_36px_rgba(107,91,58,0.10)] hover:-translate-y-0.5 hover:bg-[#efe8db]"
                  onClick={() => void finishOnboarding()}
                  type="button"
                >
                  Saltar
                </button>
              )}
              <button
                className={`rounded-xl px-10 py-3 text-sm font-semibold transition ${
                  isNextEnabled
                    ? 'bg-gradient-to-r from-[#1d6bff] to-[#00a3ff] text-white shadow-[0_16px_36px_rgba(18,82,199,0.28)] hover:-translate-y-0.5 hover:brightness-[0.98]'
                    : 'bg-[#d7e2f8] text-[#8aa0c7]'
                }`}
                onClick={() => void handleNext()}
                disabled={!isNextEnabled}
              >
                {isLast ? 'Finalizar' : 'Siguiente'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stepper({ activeStep, progress }: { activeStep: StepId; progress: number }) {
  return (
    <div className="w-full">
      <div className="relative flex items-center justify-between py-1">
        <div className="absolute left-6 right-6 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#d8e1f5]" />
        <div
          className="absolute left-6 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-[#1d6bff] to-[#00a3ff]"
          style={{ width: `calc(${progress} * (100% - 3rem))` }}
        />
        {steps.map((step) => {
          const isCompleted = step.id < activeStep;
          const isActive = step.id === activeStep;
          return (
            <div key={step.id} className="relative flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition ${
                  isCompleted
                    ? 'border-[#1d6bff] bg-[#1d6bff] text-white'
                    : isActive
                      ? 'border-[#1d6bff] bg-white text-[#1d6bff]'
                      : 'border-[#d3dcf4] bg-white text-[#9db0d4]'
                }`}
              >
                {step.id}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiscoveryStep({
  selectedChannel,
  onSelectChannel,
}: {
  selectedChannel: string;
  onSelectChannel: (value: string) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="max-w-xl">
        <h1 className="text-[23px] font-semibold leading-tight text-[#0a1f44] md:text-[24px]">
          ¡Gracias por unirte a <span className="text-[#1d6bff]">Clerio</span>!
        </h1>
        <p className="mt-3 text-base text-[#6b7c99]">
          Queremos saber cómo llegaste a Clerio para seguir optimizando nuestra experiencia de
          usuario.
        </p>
      </div>
      <div className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-3 lg:grid-cols-4">
        {reachOptions.map((option) => {
          const isSelected = selectedChannel === option.label;
          const logoSrcByLabel: Record<string, string> = {
            LinkedIn: '/brand/onboarding/linkedin_logo.png',
            Email: '/brand/onboarding/gmail_logo.png',
            Instagram: '/brand/onboarding/instagram_logo.png',
            'Twitter/X': '/brand/onboarding/x_logo.png',
            Amigos: '/brand/onboarding/mouth_logo.png',
            TikTok: '/brand/onboarding/tiktok_logo.png',
            Internet: '/brand/onboarding/internet_logo.png',
            Otro: '/brand/onboarding/others_logo.png',
          };
          const logoSrc = logoSrcByLabel[option.label] ?? null;
          return (
            <button
              key={option.label}
              onClick={() => onSelectChannel(option.label)}
              className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left text-sm shadow-[0_10px_25px_rgba(11,32,72,0.08)] transition ${
                isSelected
                  ? 'border-[#bcd4ff] bg-gradient-to-br from-[#eaf2ff] via-white to-[#f3f7ff] shadow-[0_18px_38px_rgba(14,72,180,0.18)]'
                  : 'border-[#e0e6f4] hover:-translate-y-0.5 hover:border-[#1d6bff]/50'
              }`}
            >
              {logoSrc ? (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                  <img src={logoSrc} alt={option.label} className="h-9 w-9 rounded-lg" />
                </span>
              ) : (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold uppercase text-white"
                  style={{ background: option.tone }}
                >
                  {option.icon}
                </span>
              )}
              <p className="text-sm font-semibold text-[#0b2044]">{option.label}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-sm font-semibold text-[#1d6bff]">Escoge uno</p>
    </div>
  );
}

function WorkspaceStep({
  businessName,
  businessNameLocked,
  onBusinessNameChange,
}: {
  businessName: string;
  businessNameLocked: boolean;
  onBusinessNameChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="max-w-2xl">
        <h2 className="text-[23px] font-semibold leading-tight text-[#0a1f44] md:text-[24px]">
          Configura tu <span className="text-[#1d6bff]">espacio de trabajo</span>
        </h2>
        <p className="mt-2 text-sm text-[#6b7c99] md:text-[15px] leading-snug [text-wrap:balance]">
          Completa esta información para que podamos configurar tu cuenta de forma precisa y
          ofrecerte una experiencia adaptada a tu empresa.
        </p>
      </div>
      <form className="mt-8 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-2 sm:gap-x-[6rem]">
        <Field label="Nombre de la empresa">
          <input
            placeholder="Ascend Solutions SL"
            className={`field-input workspace-field ${
              businessNameLocked ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : ''
            }`}
            value={businessName}
            onChange={(event) => onBusinessNameChange(event.target.value)}
            disabled={businessNameLocked}
            title={businessNameLocked ? 'Este campo está bloqueado porque viene del registro' : undefined}
          />
        </Field>
        <Field label="¿Qué te gustaría hacer con Clerio?">
          <select className="field-input workspace-field">
            <option value="">Elige una</option>
            <option>Encontrar mis facturas, pagar recibos</option>
            <option>Automatizar contabilización</option>
            <option>Compartir documentación</option>
            <option>Otra cosa, mariposa</option>
          </select>
        </Field>
        <Field label="Tu puesto de trabajo">
          <select className="field-input workspace-field">
            <option value="">Elige una</option>
            {jobRoles.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
        </Field>
        <Field label="Número de teléfono">
          <div className="workspace-phone field-input flex items-center gap-3">
            <span className="mr-3 flex shrink-0 items-center gap-2 border-r border-[#dfe6f5] pr-3 font-semibold text-[#0a1f44] whitespace-nowrap">
              🇪🇸 +34
            </span>
            <input
              className="workspace-phone-input"
              placeholder="123 456 789"
            />
          </div>
        </Field>
        <Field label="Personas en la empresa">
          <select className="field-input workspace-field">
            <option value="">Elige una</option>
            {peopleRanges.map((range) => (
              <option key={range}>{range}</option>
            ))}
          </select>
        </Field>
        <Field label="¿Cómo lleváis la contabilidad?">
          <select className="field-input workspace-field">
            <option value="">Elige una</option>
            {accountingWays.map((way) => (
              <option key={way}>{way}</option>
            ))}
          </select>
        </Field>
      </form>
    </div>
  );
}

function IntegrationsStep({
  items,
  initialStage,
  autoAdvanceTo,
  onComplete,
}: {
  items: Integration[];
  initialStage: 'email' | 'storage' | 'success';
  autoAdvanceTo: 'email' | 'storage' | 'success' | null;
  onComplete: () => void;
}) {
  const logoSrcByIntegrationName: Record<string, string> = {
    Gmail: '/brand/onboarding/gmail_logo.png',
    Outlook: '/brand/onboarding/outlook_logo.png',
    WhatsApp: '/brand/onboarding/whatsapp_logo.png',
    Dropbox: '/brand/onboarding/dropbox_logo.png',
    'One Drive': '/brand/onboarding/onedrive_logo.png',
    'Wolters Kluwer': '/brand/onboarding/wolters_logo.png',
    Hubspot: '/brand/onboarding/hubspot_logo.png',
    'Microsoft Teams': '/brand/onboarding/teams_logo.png',
    'Google Drive': '/brand/onboarding/drive_logo.png',
  };

  const [stage, setStage] = useState<'email' | 'storage' | 'success'>(initialStage);
  const [emailSelection, setEmailSelection] = useState<string | null>(null);
  const [storageSelection, setStorageSelection] = useState<string | null>(null);
  const didAutoAdvanceRef = useRef(false);

  useEffect(() => {
    setStage(initialStage);
    didAutoAdvanceRef.current = false;
  }, [initialStage]);

  useEffect(() => {
    if (!autoAdvanceTo) return;
    if (didAutoAdvanceRef.current) return;
    if (autoAdvanceTo === stage) {
      didAutoAdvanceRef.current = true;
      return;
    }

    const slideTimeout = window.setTimeout(() => {
      didAutoAdvanceRef.current = true;
      setStage(autoAdvanceTo);
    }, 650);

    return () => {
      window.clearTimeout(slideTimeout);
    };
  }, [autoAdvanceTo, stage]);

  const buildOnboardingRedirect = (fromStage: 'email' | 'storage', toStage: 'storage' | 'success') => {
    const url = new URL('/onboarding', window.location.origin);
    url.searchParams.set('step', '3');
    url.searchParams.set('integrationFrom', fromStage);
    url.searchParams.set('integrationTo', toStage);
    return `${url.pathname}${url.search}`;
  };

  const redirectToOAuthStart = (path: string, fromStage: 'email' | 'storage', nextStage: 'storage' | 'success') => {
    const url = new URL(path, window.location.origin);
    url.searchParams.set('redirect', buildOnboardingRedirect(fromStage, nextStage));
    window.location.href = url.toString();
  };

  const stageOrder = ['email', 'storage', 'success'] as const;
  const stageIndex = stageOrder.indexOf(stage);

  const handleEmailConnect = () => {
    if (!emailSelection) return;

    if (emailSelection === 'gmail') {
      redirectToOAuthStart('/api/gmail/oauth/start', 'email', 'storage');
      return;
    }

    if (emailSelection === 'outlook') {
      redirectToOAuthStart('/api/oauth/outlook/start', 'email', 'storage');
      return;
    }

    setStage('storage');
    setStorageSelection(null);
  };

  const handleStorageConnect = () => {
    if (!storageSelection) return;

    if (storageSelection === 'drive') {
      redirectToOAuthStart('/api/drive/oauth/start', 'storage', 'success');
      return;
    }

    if (storageSelection === 'onedrive') {
      redirectToOAuthStart('/api/oauth/onedrive/start', 'storage', 'success');
      return;
    }

    setStage('success');
  };

  useEffect(() => {
    if (stage === 'success') {
      onComplete();
    }
  }, [onComplete, stage]);

  const handlePrevStage = () => {
    if (stage === 'storage') {
      setStage('email');
      return;
    }
    if (stage === 'success') {
      setStage('storage');
      return;
    }
  };

  const handleNextStage = () => {
    if (stage === 'email') {
      setStage('storage');
      return;
    }
  };

  const renderConnectAction = (disabled: boolean, onClick: () => void) => (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 self-center rounded-2xl px-5 py-2.5 text-sm font-semibold transition active:translate-y-0 ${
        disabled
          ? 'cursor-not-allowed bg-[#d9e3f7] text-[#98a7c9]'
          : 'bg-gradient-to-r from-[#1d6bff] to-[#00a3ff] text-white hover:-translate-y-0.5 hover:brightness-[0.98]'
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      <Plug className={`h-4 w-4 ${disabled ? 'text-[#98a7c9]' : 'text-white'}`} />
      Conectar
    </button>
  );

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="w-full lg:w-[35%]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7f91b1]">Integraciones</p>
        <h2 className="mt-3 text-[23px] font-semibold leading-tight text-[#0a1f44] md:text-[24px]">
          Automatiza la <span className="text-[#1d6bff]">recogida de tus facturas</span>
        </h2>
        <p className="mt-3 text-base text-[#6b7c99]">
          Conecta tus canales de facturación para centralizar la gestión documental y automatizar la recepción de
          facturas.
        </p>
        <div className="mt-4 rounded-2xl border border-[#e4e9f5] bg-[#f9fbff] px-3 py-3.5 shadow-[0_14px_40px_rgba(15,40,92,0.07)]">
          <div className="max-h-[10.5rem] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              {items.map((integration) => {
                const logoSrc = logoSrcByIntegrationName[integration.name] ?? null;
                return (
                  <div
                    key={integration.name}
                    className="flex min-h-[50px] items-center gap-2 rounded-2xl border border-[#dde4f3] bg-white px-2 py-1.5 shadow-[0_10px_24px_rgba(12,32,72,0.05)]"
                  >
                    {logoSrc ? (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                        <img src={logoSrc} alt={integration.name} className="h-9 w-9 rounded-lg" />
                      </span>
                    ) : (
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[9px] font-semibold text-white"
                        style={{ background: integration.color }}
                      >
                        {integration.icon}
                      </div>
                    )}
                    <p className="text-[10px] font-semibold text-[#0a1f44] leading-tight">{integration.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[65%] flex flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <div className="relative w-full overflow-hidden">
            <div
              className="flex transform-gpu will-change-transform transition-transform duration-700 ease-in-out"
              style={{
                transform: `translate3d(-${stageIndex * 100}%, 0, 0)`,
                backfaceVisibility: 'hidden',
              }}
            >
              <div className="min-w-full shrink-0">
                <IntegrationPanel
                  title={
                    <>
                      Conecta tu <span className="text-[#1d6bff]">correo</span>
                    </>
                  }
                  subtitle="Selecciona desde dónde recibes tus facturas"
                  options={emailProviders}
                  selection={emailSelection}
                  onSelect={setEmailSelection}
                  action={renderConnectAction(!emailSelection, handleEmailConnect)}
                />
              </div>
              <div className="min-w-full shrink-0">
                <IntegrationPanel
                  title={
                    <>
                      Sincroniza tu <span className="text-[#1d6bff]">almacenamiento</span>
                    </>
                  }
                  subtitle="Indica dónde guardas tus documentos"
                  options={storageProviders}
                  selection={storageSelection}
                  onSelect={setStorageSelection}
                  action={renderConnectAction(!storageSelection, handleStorageConnect)}
                />
              </div>
              <div className="min-w-full shrink-0">
                <SuccessPanel />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e1e8f7] bg-transparent text-[#9bb0d6] transition hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-30"
            onClick={handlePrevStage}
            disabled={stage === 'email'}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center gap-1.5">
            <StageDot active={stage === 'email'} completed={stageIndex > 0} />
            <StageDot active={stage === 'storage'} completed={stageIndex > 1} />
            <StageDot active={stage === 'success'} completed={stage === 'success'} />
          </div>
          <button
            type="button"
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
              stage === 'email'
                ? 'border-[#e1e8f7] bg-transparent text-[#2d63df] hover:bg-white/60'
                : 'border-[#e1e8f7] bg-transparent text-[#b3c2df] cursor-not-allowed'
            }`}
            onClick={handleNextStage}
            disabled={stage !== 'email'}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function IntegrationPanel({
  title,
  subtitle,
  options,
  selection,
  onSelect,
  action,
}: {
  title: ReactNode;
  subtitle: string;
  options: ProviderOption[];
  selection: string | null;
  onSelect: (value: string) => void;
  action?: ReactNode;
}) {
  const logoSrcByProviderValue: Record<string, string> = {
    gmail: '/brand/onboarding/gmail_logo.png',
    outlook: '/brand/onboarding/outlook_logo.png',
    drive: '/brand/onboarding/drive_logo.png',
    onedrive: '/brand/onboarding/onedrive_logo.png',
    'other-email': '/brand/onboarding/others_logo.png',
    'other-storage': '/brand/onboarding/others_logo.png',
  };

  return (
    <div className="flex min-h-[320px] flex-col justify-center">
      <div className="mx-auto w-full max-w-[520px] bg-transparent px-2 pt-1 pb-1">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#7f91b1]">Flujo de integración</p>
          <h3 className="mt-1 text-[23px] font-semibold leading-tight text-[#0a1f44] md:text-[24px]">{title}</h3>
          <p className="mt-1.5 text-sm text-[#5e6b87] md:text-[15px]">{subtitle}</p>
        </div>
        <div className="mt-10 grid w-full grid-cols-1 justify-items-center gap-2 sm:grid-cols-2 sm:gap-x-2 sm:gap-y-2">
          {options.map((option) => {
            const isActive = option.value === selection;
            const isOther = option.value.includes('other');
            const logoSrc = logoSrcByProviderValue[option.value] ?? null;
            return (
              <button
                key={option.value}
                type="button"
                className={`w-full max-w-[172px] rounded-2xl p-3 text-left transition ${
                  isActive
                    ? 'border border-[#1d6bff] bg-white shadow-[0_18px_45px_rgba(17,60,166,0.18)]'
                    : 'border border-transparent bg-white/70 shadow-[0_12px_30px_rgba(9,25,64,0.07)] hover:-translate-y-0.5'
                } ${isOther ? 'sm:col-span-2' : ''}`}
                onClick={() => onSelect(option.value)}
              >
                <div className="flex items-center gap-2.5">
                  {logoSrc ? (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                      <img src={logoSrc} alt={option.label} className="h-9 w-9 rounded-lg" />
                    </span>
                  ) : (
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold text-white"
                      style={{ background: option.accent }}
                    >
                      {option.icon}
                    </div>
                  )}
                  <p className="text-[13px] font-semibold text-[#0a1f44]">{option.label}</p>
                </div>
              </button>
            );
          })}
        </div>
        {action && <div className="mt-4 flex items-center justify-center">{action}</div>}
      </div>
    </div>
  );
}

function SuccessPanel() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
      <div className="text-5xl leading-none">🥳</div>
      <h3 className="mt-6 text-[23px] font-semibold leading-tight text-[#0a1f44] md:text-[24px]">
        ¡Integración <span className="text-[#1d6bff]">realizada</span>!
      </h3>
      <p className="mt-2 max-w-sm text-sm text-[#5e6b87]">
        Ya podemos captar tus facturas automáticamente. En cuanto recibamos nuevos documentos, los verás en Clerio sin
        mover un dedo.
      </p>
      <div className="mt-6 flex gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#8ca0c5]">
        Correo <Check className="h-[18px] w-[18px] text-[#1c9c63]" strokeWidth={3} /> Almacenamiento{' '}
        <Check className="h-[18px] w-[18px] text-[#1c9c63]" strokeWidth={3} />
      </div>
    </div>
  );
}

function StageDot({ active, completed }: { active: boolean; completed: boolean }) {
  return (
    <span
      className={`flex h-2 w-2 items-center justify-center rounded-full ${
        active ? 'bg-[#1d6bff]' : completed ? 'bg-[#bfcdea]' : 'bg-[#dfe6f5]'
      }`}
    />
  );
}

function InviteStep({
  inviteEmail,
  onChangeEmail,
  message,
  onSend,
}: {
  inviteEmail: string;
  onChangeEmail: (value: string) => void;
  message: string;
  onSend: () => boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="max-w-2xl text-[23px] font-semibold leading-tight text-[#0a1f44] md:text-[24px]">
        Invita a tu asesoría <span className="text-[#1d6bff]">y optimiza vuestro trabajo</span>
      </h2>
      <p className="mt-4 max-w-2xl text-base text-[#6b7c99]">
        Cuando tu asesoría usa Clerio, las facturas y documentos se sincronizan automáticamente. Tú no tendrás que enviar
        nada, y ellos podrán gestionar tu contabilidad en tiempo real.
      </p>
      <div className="mt-6 w-full max-w-sm text-left">
        <label className="flex flex-col gap-2 text-sm font-semibold text-[#0a1f44]">
          Email de la asesoría
          <input
            className="field-input"
            placeholder="asesoria@empresa.com"
            value={inviteEmail}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChangeEmail(event.target.value)}
          />
        </label>
        {message && (
          <p className={`mt-2 text-sm ${message.includes('válido') ? 'text-[#d64545]' : 'text-[#1c9c63]'}`}>
            {message}
          </p>
        )}
      </div>
      <button
        type="button"
        className="mt-8 rounded-xl bg-gradient-to-r from-[#1d6bff] to-[#00a3ff] px-8 py-3 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(8,46,135,0.26)] transition hover:-translate-y-0.5 hover:brightness-[0.98]"
        onClick={onSend}
      >
        Enviar invitación
      </button>
      <p className="mt-10 max-w-xl text-sm text-[#97a6c5]">
        Cuando tu asesoría está en Clerio el resto ocurre solo. Automatización, comunicación y control en un mismo lugar.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-[#0a1f44]">
      {label}
      {children}
    </label>
  );
}
