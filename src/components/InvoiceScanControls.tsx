'use client';

import React from 'react';
import { Loader2, Plug, RefreshCw, ScanSearch, X } from 'lucide-react';
import Image from 'next/image';

import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';
import { triggerN8nAction } from '@/lib/n8n';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

type InvoiceScanControlsProps = {
  onScanned?: () => void;
  showHoldedScan?: boolean;
};

type AuthUserScanSettings = {
  email_type: string | null;
};

type ScanLogRow = {
  created_at: string;
};

type HoldedKeyStatusResponse = {
  connected?: boolean;
};

type InvoiceScanMetaCacheEntry = {
  emailType: string | null;
  lastScanAt: string | null;
  isHoldedConnected: boolean;
};

const SCAN_ERROR_CODES = {
  MISSING_EMAIL_TYPE: 700,
  GOOGLE_CREDENTIALS_REVOKED: 701,
} as const;

const HOLDED_STATUS_EVENT = 'holded-status-changed';
const SCAN_IN_PROGRESS_EVENT = 'invoice-scan-in-progress-changed';
const SCAN_IN_PROGRESS_STORAGE_KEY = 'invoice-scan-in-progress';
const HOLDED_SCAN_IN_PROGRESS_EVENT = 'holded-scan-in-progress-changed';
const HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY = 'holded-scan-in-progress';
const invoiceScanMetaCache = new Map<string, InvoiceScanMetaCacheEntry>();
const RECONNECT_FLOW_PARAM = 'scanReconnect';
const RECONNECT_STAGE_PARAM = 'scanFlowStage';
const RECONNECT_FLOW_STORAGE_KEY = 'scanReconnectStage';
const SCAN_TOAST_DURATION_MS = 3000;
const SCAN_TOAST_BASE_CLASS =
  'w-[420px] max-w-[calc(100vw-2rem)] min-h-[104px] data-[state=closed]:slide-out-to-right-0 data-[state=closed]:fade-out-100';
const SCAN_TOAST_SUCCESS_CLASS = `${SCAN_TOAST_BASE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-950`;
const SCAN_TOAST_CLERIO_START_CLASS = `${SCAN_TOAST_BASE_CLASS} border-[#1d6bff] bg-white text-[#0a1f44]`;
const SCAN_TOAST_HOLDED_START_CLASS = `${SCAN_TOAST_BASE_CLASS} border-[#ff4254] bg-white text-[#7f1d24]`;
const SCAN_TOAST_LOGO_SIZE = 40;
const SCAN_TOAST_LOGO_CLASS = 'pointer-events-none absolute right-5 top-1/2 h-10 w-10 -translate-y-1/2 object-contain';
const SCAN_TOAST_DESCRIPTION_CLASS = 'block pr-16';

type RevokedModalStage = 'warning' | 'gmail' | 'drive' | 'success';
const REVOKED_MODAL_STAGE_ORDER: ReadonlyArray<RevokedModalStage> = ['warning', 'gmail', 'drive', 'success'];

const hasRevokedCredentialsStatus = (payload: unknown) => {
  if (!payload) {
    return false;
  }

  const checkItem = (item: unknown) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const status = (item as { credentials_status?: unknown }).credentials_status;
    return typeof status === 'string' && status.toUpperCase() === 'REVOKED';
  };

  if (Array.isArray(payload)) {
    return payload.some(checkItem);
  }

  return checkItem(payload);
};

const formatElapsedSince = (iso: string | null) => {
  if (!iso) {
    return 'Sin registros';
  }

  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return 'Sin registros';
  }

  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (totalHours < 24) {
    return minutes > 0 ? `${totalHours} h ${minutes} min` : `${totalHours} h`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
};

const getScanInProgress = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.sessionStorage.getItem(SCAN_IN_PROGRESS_STORAGE_KEY) === '1';
};

const setScanInProgress = (inProgress: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (inProgress) {
    window.sessionStorage.setItem(SCAN_IN_PROGRESS_STORAGE_KEY, '1');
  } else {
    window.sessionStorage.removeItem(SCAN_IN_PROGRESS_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(SCAN_IN_PROGRESS_EVENT, { detail: { inProgress } }));
};

const getHoldedScanInProgress = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.sessionStorage.getItem(HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY) === '1';
};

const setHoldedScanInProgress = (inProgress: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (inProgress) {
    window.sessionStorage.setItem(HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY, '1');
  } else {
    window.sessionStorage.removeItem(HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(HOLDED_SCAN_IN_PROGRESS_EVENT, { detail: { inProgress } }));
};

export function InvoiceScanControls({ onScanned, showHoldedScan = false }: InvoiceScanControlsProps) {
  const { user } = useDashboardSession();
  const { toast } = useToast();
  const cacheKey = `${user?.id ?? 'anonymous'}|${showHoldedScan ? 'holded' : 'generic'}`;
  const cachedMeta = invoiceScanMetaCache.get(cacheKey);
  const [loading, setLoading] = React.useState(false);
  const [isScanInProgress, setIsScanInProgress] = React.useState<boolean>(() => getScanInProgress());
  const [holdedLoading, setHoldedLoading] = React.useState(false);
  const [isHoldedScanInProgress, setIsHoldedScanInProgress] = React.useState<boolean>(() => getHoldedScanInProgress());
  const [lastScanAt, setLastScanAt] = React.useState<string | null>(() => cachedMeta?.lastScanAt ?? null);
  const [emailType, setEmailType] = React.useState<string | null>(() => cachedMeta?.emailType ?? null);
  const [isBootstrapping, setIsBootstrapping] = React.useState(() => !Boolean(cachedMeta));
  const [isHoldedConnected, setIsHoldedConnected] = React.useState(() => cachedMeta?.isHoldedConnected ?? false);
  const [showCredentialsRevokedModal, setShowCredentialsRevokedModal] = React.useState(false);
  const [revokedModalStage, setRevokedModalStage] = React.useState<RevokedModalStage>('warning');
  const [isRedirectingToOAuth, setIsRedirectingToOAuth] = React.useState(false);

  const setReconnectFlowStage = React.useCallback((stage: 'gmail' | 'drive' | 'success' | null) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (!stage) {
        window.sessionStorage.removeItem(RECONNECT_FLOW_STORAGE_KEY);
        return;
      }

      window.sessionStorage.setItem(RECONNECT_FLOW_STORAGE_KEY, stage);
    } catch {
      // noop
    }
  }, []);

  const getReconnectFlowStage = React.useCallback((): 'gmail' | 'drive' | 'success' | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const value = window.sessionStorage.getItem(RECONNECT_FLOW_STORAGE_KEY);
      if (value === 'gmail' || value === 'drive' || value === 'success') {
        return value;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  React.useEffect(() => {
    const cached = invoiceScanMetaCache.get(cacheKey);
    if (cached) {
      setEmailType(cached.emailType);
      setLastScanAt(cached.lastScanAt);
      setIsHoldedConnected(cached.isHoldedConnected);
      setIsBootstrapping(false);
      return;
    }

    setEmailType(null);
    setLastScanAt(null);
    setIsHoldedConnected(false);
    setIsBootstrapping(true);
  }, [cacheKey]);

  React.useEffect(() => {
    if (!user?.id) {
      return;
    }

    invoiceScanMetaCache.set(cacheKey, {
      emailType,
      lastScanAt,
      isHoldedConnected,
    });
  }, [cacheKey, emailType, isHoldedConnected, lastScanAt, user?.id]);

  const loadScanMeta = React.useCallback(async () => {
    if (!user?.id) {
      setEmailType(null);
      setLastScanAt(null);
      setIsHoldedConnected(false);
      setIsBootstrapping(false);
      return;
    }

    const cached = invoiceScanMetaCache.get(cacheKey);
    setIsBootstrapping(!cached);

    const [{ data: authUser, error: authUserError }, { data: lastLog, error: logError }, holdedStatusResult] =
      await Promise.all([
        supabase
          .from('auth_users')
          .select('email_type')
          .eq('user_uid', user.id)
          .maybeSingle(),
        supabase
          .from('logs')
          .select('created_at')
          .eq('user_uid', user.id)
          .eq('log', 'Escaner ejecutado')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        showHoldedScan
          ? fetch('/api/holded/key', {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            })
          : Promise.resolve(null),
      ]);

    if (authUserError) {
      console.error('Error fetching auth user scan settings', authUserError);
    }

    if (logError) {
      console.error('Error fetching last scan log', logError);
    }

    const typedAuthUser = authUser as AuthUserScanSettings | null;
    const typedLastLog = lastLog as ScanLogRow | null;

    const nextEmailType = authUserError ? (cached?.emailType ?? null) : typedAuthUser?.email_type?.trim() || null;
    const nextLastScanAt = logError ? (cached?.lastScanAt ?? null) : typedLastLog?.created_at ?? null;

    setEmailType(nextEmailType);
    setLastScanAt(nextLastScanAt);

    if (showHoldedScan) {
      try {
        if (holdedStatusResult && holdedStatusResult.ok) {
          const payload = (await holdedStatusResult.json()) as HoldedKeyStatusResponse;
          setIsHoldedConnected(Boolean(payload.connected));
        } else if (cached) {
          setIsHoldedConnected(cached.isHoldedConnected);
        }
      } catch {
        if (cached) {
          setIsHoldedConnected(cached.isHoldedConnected);
        }
      }
    } else {
      setIsHoldedConnected(false);
    }

    setIsBootstrapping(false);
  }, [cacheKey, showHoldedScan, user?.id]);

  React.useEffect(() => {
    void loadScanMeta();
  }, [loadScanMeta]);

  React.useEffect(() => {
    const handleScanInProgressChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ inProgress?: boolean }>;
      if (typeof customEvent.detail?.inProgress === 'boolean') {
        setIsScanInProgress(customEvent.detail.inProgress);
        return;
      }

      setIsScanInProgress(getScanInProgress());
    };

    setIsScanInProgress(getScanInProgress());
    window.addEventListener(SCAN_IN_PROGRESS_EVENT, handleScanInProgressChange);

    return () => {
      window.removeEventListener(SCAN_IN_PROGRESS_EVENT, handleScanInProgressChange);
    };
  }, []);

  React.useEffect(() => {
    if (!showHoldedScan) {
      return undefined;
    }

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ connected?: boolean }>;
      if (typeof customEvent.detail?.connected === 'boolean') {
        setIsHoldedConnected(customEvent.detail.connected);
      } else {
        void loadScanMeta();
      }
    };

    window.addEventListener(HOLDED_STATUS_EVENT, handler);
    return () => {
      window.removeEventListener(HOLDED_STATUS_EVENT, handler);
    };
  }, [loadScanMeta, showHoldedScan]);

  React.useEffect(() => {
    if (!showHoldedScan) {
      return undefined;
    }

    const handleInProgressChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ inProgress?: boolean }>;
      if (typeof customEvent.detail?.inProgress === 'boolean') {
        setIsHoldedScanInProgress(customEvent.detail.inProgress);
        return;
      }

      setIsHoldedScanInProgress(getHoldedScanInProgress());
    };

    setIsHoldedScanInProgress(getHoldedScanInProgress());
    window.addEventListener(HOLDED_SCAN_IN_PROGRESS_EVENT, handleInProgressChange);

    return () => {
      window.removeEventListener(HOLDED_SCAN_IN_PROGRESS_EVENT, handleInProgressChange);
    };
  }, [showHoldedScan]);

  const closeCredentialsRevokedModal = React.useCallback(() => {
    setShowCredentialsRevokedModal(false);
    setRevokedModalStage('warning');
    setIsRedirectingToOAuth(false);
    setReconnectFlowStage(null);
  }, [setReconnectFlowStage]);

  const buildReconnectRedirectPath = React.useCallback((stage: 'gmail' | 'drive' | 'success') => {
    const redirectUrl = new URL(window.location.href);
    redirectUrl.searchParams.set(RECONNECT_FLOW_PARAM, '1');
    redirectUrl.searchParams.set(RECONNECT_STAGE_PARAM, stage);

    redirectUrl.searchParams.delete('skipDriveIntegrationWebhook');
    redirectUrl.searchParams.delete('gmail');
    redirectUrl.searchParams.delete('drive');
    redirectUrl.searchParams.delete('reason');

    return `${redirectUrl.pathname}${redirectUrl.search}`;
  }, []);

  const handleReconnectGmail = React.useCallback(() => {
    setIsRedirectingToOAuth(true);
    setReconnectFlowStage('gmail');
    const url = new URL('/api/gmail/oauth/start', window.location.origin);
    url.searchParams.set('redirect', buildReconnectRedirectPath('gmail'));
    window.location.href = url.toString();
  }, [buildReconnectRedirectPath, setReconnectFlowStage]);

  const handleReconnectDrive = React.useCallback(() => {
    setIsRedirectingToOAuth(true);
    setReconnectFlowStage('success');
    const url = new URL('/api/drive/oauth/start', window.location.origin);
    url.searchParams.set('redirect', buildReconnectRedirectPath('success'));
    window.location.href = url.toString();
  }, [buildReconnectRedirectPath, setReconnectFlowStage]);

  React.useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const stageFromStorage = getReconnectFlowStage();
    const isReconnectFlow = currentUrl.searchParams.get(RECONNECT_FLOW_PARAM) === '1' || Boolean(stageFromStorage);

    if (!isReconnectFlow) {
      return;
    }

    const stageParam = currentUrl.searchParams.get(RECONNECT_STAGE_PARAM);
    const activeStage =
      stageParam === 'success' || stageParam === 'drive' || stageParam === 'gmail' ? stageParam : stageFromStorage;
    const gmailStatus = currentUrl.searchParams.get('gmail');
    const driveStatus = currentUrl.searchParams.get('drive');
    const reason = currentUrl.searchParams.get('reason');

    setShowCredentialsRevokedModal(true);
    setIsRedirectingToOAuth(false);

    let slideTimeout: number | null = null;

    if (activeStage === 'success') {
      setReconnectFlowStage('success');
      setRevokedModalStage('success');
    } else if (activeStage === 'drive') {
      setRevokedModalStage('drive');

      if (driveStatus === 'success') {
        setReconnectFlowStage('success');
        slideTimeout = window.setTimeout(() => {
          setRevokedModalStage('success');
        }, 220);
      } else if (driveStatus === 'error') {
        setReconnectFlowStage('drive');
        toast({
          title: 'No se pudo conectar Google Drive',
          description: reason || 'Inténtalo de nuevo.',
          variant: 'destructive',
        });
      }
    } else {
      setRevokedModalStage('gmail');

      if (gmailStatus === 'success') {
        setReconnectFlowStage('drive');
        slideTimeout = window.setTimeout(() => {
          setRevokedModalStage('drive');
        }, 220);
      } else if (gmailStatus === 'error') {
        setReconnectFlowStage('gmail');
        toast({
          title: 'No se pudo conectar Gmail',
          description: reason || 'Inténtalo de nuevo.',
          variant: 'destructive',
        });
      }
    }

    currentUrl.searchParams.delete(RECONNECT_FLOW_PARAM);
    currentUrl.searchParams.delete(RECONNECT_STAGE_PARAM);
    currentUrl.searchParams.delete('skipDriveIntegrationWebhook');
    currentUrl.searchParams.delete('gmail');
    currentUrl.searchParams.delete('drive');
    currentUrl.searchParams.delete('reason');
    window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);

    return () => {
      if (slideTimeout !== null) {
        window.clearTimeout(slideTimeout);
      }
    };
  }, [getReconnectFlowStage, setReconnectFlowStage, toast]);

  const handleScan = async () => {
    if (!user?.id || loading || isScanInProgress) {
      return;
    }

    if (!emailType) {
      const errorCode = SCAN_ERROR_CODES.MISSING_EMAIL_TYPE;
      console.warn(`[scan] ERROR CODE = ${errorCode}`, { userId: user?.id });
      toast({
        title: 'No se pudo lanzar el escaneo',
        description: 'Por favor, refresca la página y vuelve a intentarlo. Si el error persiste, contacta con hola@clerio.es.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setScanInProgress(true);
    toast({
      title: 'Escaneo iniciado',
      description: (
        <span className={SCAN_TOAST_DESCRIPTION_CLASS}>
          <span>Se ha iniciado el escaneo de facturas.</span>
          <Image
            src="/brand/IMAGO_AZUL.png"
            alt="Clerio"
            width={SCAN_TOAST_LOGO_SIZE}
            height={SCAN_TOAST_LOGO_SIZE}
            className={SCAN_TOAST_LOGO_CLASS}
          />
        </span>
      ),
      duration: SCAN_TOAST_DURATION_MS,
      className: SCAN_TOAST_CLERIO_START_CLASS,
    });

    try {
      const response = await triggerN8nAction(emailType);
      const payload = (await response.json().catch(() => null)) as unknown;

      const hasRevokedCredentials = hasRevokedCredentialsStatus(payload);

      if (!hasRevokedCredentials) {
        toast({
          title: 'Escaneo finalizado',
          description: 'Se ha finalizado el escaneo de facturas.',
          duration: SCAN_TOAST_DURATION_MS,
          className: SCAN_TOAST_SUCCESS_CLASS,
        });
      }

      onScanned?.();
      window.setTimeout(() => {
        void loadScanMeta();
      }, 1200);

      if (hasRevokedCredentials) {
        const errorCode = SCAN_ERROR_CODES.GOOGLE_CREDENTIALS_REVOKED;
        console.warn(`[scan] ERROR CODE = ${errorCode}`, { userId: user?.id });
        setIsRedirectingToOAuth(false);
        setRevokedModalStage('warning');
        setReconnectFlowStage(null);
        setShowCredentialsRevokedModal(true);
      }
    } catch (error) {
      toast({
        title: 'No se pudo lanzar el escaneo',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
        className: SCAN_TOAST_BASE_CLASS,
      });
    } finally {
      setLoading(false);
      setScanInProgress(false);
    }
  };

  const handleHoldedScan = async () => {
    if (!user?.id || holdedLoading || isHoldedScanInProgress) {
      return;
    }

    setHoldedLoading(true);
    setHoldedScanInProgress(true);
    toast({
      title: 'Escaneo Holded iniciado',
      description: (
        <span className={SCAN_TOAST_DESCRIPTION_CLASS}>
          <span>Se ha iniciado el escaneo de facturas de Holded.</span>
          <Image
            src="/brand/tab_ingresos/holded_logo.png"
            alt="Holded"
            width={SCAN_TOAST_LOGO_SIZE}
            height={SCAN_TOAST_LOGO_SIZE}
            className={SCAN_TOAST_LOGO_CLASS}
          />
        </span>
      ),
      duration: SCAN_TOAST_DURATION_MS,
      className: SCAN_TOAST_HOLDED_START_CLASS,
    });

    try {
      const response = await fetch('/api/holded/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Webhook respondió con ${response.status}`);
      }

      toast({
        title: 'Escaneo finalizado',
        description: 'Se ha finalizado el escaneo de facturas de Holded.',
        duration: SCAN_TOAST_DURATION_MS,
        className: SCAN_TOAST_SUCCESS_CLASS,
      });
      onScanned?.();
    } catch (error) {
      toast({
        title: 'No se pudo lanzar Escanear Holded',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
        className: SCAN_TOAST_BASE_CLASS,
      });
    } finally {
      setHoldedLoading(false);
      setHoldedScanInProgress(false);
    }
  };

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center text-sm text-gray-500 gap-2">
          <RefreshCw
            className={`h-4 w-4 transition-colors ${loading || isBootstrapping ? 'animate-spin text-slate-900' : 'text-gray-500'}`}
          />
          <span>{`Último escaneo hace ${formatElapsedSince(lastScanAt)}`}</span>
        </div>

        <div className="flex items-center gap-2">
          {showHoldedScan && isHoldedConnected ? (
            <Button
              type="button"
              onClick={handleHoldedScan}
              disabled={holdedLoading || isHoldedScanInProgress || isBootstrapping || !user?.id}
              className="bg-[#ff4254] text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#ff3247] hover:shadow-md active:translate-y-0 focus-visible:ring-2 focus-visible:ring-[#ff9ca6]"
            >
              {holdedLoading || isHoldedScanInProgress ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Image
                  src="/brand/tab_ingresos/holded_mark_white.svg"
                  alt="Holded"
                  width={16}
                  height={16}
                  className="h-4 w-4"
                />
              )}
              Escanear Holded
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={handleScan}
            disabled={loading || isScanInProgress || isBootstrapping || !user?.id}
            className="bg-slate-950 text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-md active:translate-y-0 focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {loading || isScanInProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
            Escanear Facturas
          </Button>
        </div>
      </div>

      {showCredentialsRevokedModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-[470px] overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_30px_90px_rgba(15,23,42,0.28)] sm:px-6">
            <button
              type="button"
              aria-label="Cerrar"
              onClick={closeCredentialsRevokedModal}
              className="absolute right-4 top-4 z-30 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative w-full overflow-hidden">
              <div
                className="flex w-full transform-gpu transition-transform duration-500 ease-in-out"
                style={{ transform: `translate3d(-${REVOKED_MODAL_STAGE_ORDER.indexOf(revokedModalStage) * 100}%, 0, 0)` }}
              >
                <div className="w-full min-w-full flex-none px-1 text-center">
                  <h3 className="pr-7 text-[28px] font-semibold tracking-[-0.02em] leading-[1.08] text-[#0a1f44] sm:text-[30px]">
                    Credenciales de Google caducadas
                  </h3>
                  <p className="mt-2 text-base leading-7 text-slate-600">
                    Tus credenciales de Google han caducado. Para seguir escaneando facturas, vuelve a integrar Gmail y
                    Google Drive.
                  </p>
                  <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button
                      type="button"
                      onClick={closeCredentialsRevokedModal}
                      variant="outline"
                      className="h-11 w-full max-w-[180px] rounded-xl border-slate-300 text-base text-slate-700 hover:bg-slate-100"
                    >
                      Más tarde
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setReconnectFlowStage('gmail');
                        setRevokedModalStage('gmail');
                      }}
                      className="h-11 w-full max-w-[180px] rounded-xl bg-gradient-to-r from-[#1d6bff] to-[#00a3ff] text-base font-semibold text-white shadow-[0_14px_30px_rgba(21,95,245,0.35)] transition-transform duration-200 hover:-translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_18px_34px_rgba(21,95,245,0.38)] active:translate-y-0"
                    >
                      Integrar ahora
                    </Button>
                  </div>
                </div>

                <div className="w-full min-w-full flex-none px-1 text-center">
                  <h3 className="pr-7 text-[28px] font-semibold tracking-[-0.02em] leading-[1.08] text-[#0a1f44] sm:text-[30px]">
                    Reconecta Gmail
                  </h3>
                  <div className="mt-4">
                    <ReconnectIntegrationCard logoSrc="/brand/onboarding/gmail_logo.png" name="Gmail" />
                  </div>
                  <div className="mt-7 flex justify-center">
                    <Button
                      type="button"
                      onClick={handleReconnectGmail}
                      disabled={isRedirectingToOAuth}
                      className="h-11 w-full max-w-[240px] rounded-xl bg-gradient-to-r from-[#1d6bff] to-[#00a3ff] text-base font-semibold text-white shadow-[0_14px_30px_rgba(21,95,245,0.35)] transition-transform duration-200 hover:-translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_18px_34px_rgba(21,95,245,0.38)] active:translate-y-0"
                    >
                      <Plug className="mr-1 h-4 w-4" />
                      {isRedirectingToOAuth ? 'Conectando…' : 'Conectar'}
                    </Button>
                  </div>
                </div>

                <div className="w-full min-w-full flex-none px-1 text-center">
                  <h3 className="pr-7 text-[28px] font-semibold tracking-[-0.02em] leading-[1.08] text-[#0a1f44] sm:text-[30px]">
                    Reconecta Google Drive
                  </h3>
                  <div className="mt-4">
                    <ReconnectIntegrationCard logoSrc="/brand/onboarding/drive_logo.png" name="Google Drive" />
                  </div>
                  <div className="mt-7 flex justify-center">
                    <Button
                      type="button"
                      onClick={handleReconnectDrive}
                      disabled={isRedirectingToOAuth}
                      className="h-11 w-full max-w-[240px] rounded-xl bg-gradient-to-r from-[#1d6bff] to-[#00a3ff] text-base font-semibold text-white shadow-[0_14px_30px_rgba(21,95,245,0.35)] transition-transform duration-200 hover:-translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_18px_34px_rgba(21,95,245,0.38)] active:translate-y-0"
                    >
                      <Plug className="mr-1 h-4 w-4" />
                      {isRedirectingToOAuth ? 'Conectando…' : 'Conectar'}
                    </Button>
                  </div>
                </div>

                <div className="w-full min-w-full flex-none px-1 text-center">
                  <div className="text-5xl leading-none">🥳</div>
                  <h3 className="mt-4 text-[28px] font-semibold tracking-[-0.02em] leading-[1.08] text-[#0a1f44] sm:text-[30px]">
                    ¡Reconexión completada!
                  </h3>
                  <p className="mt-2 text-base leading-7 text-slate-600">
                    Gmail y Google Drive ya están integrados de nuevo. Por favor, ejecuta el escaneo de nuevo.
                  </p>
                  <div className="mt-6 flex justify-center">
                    <Button
                      type="button"
                      onClick={closeCredentialsRevokedModal}
                      className="h-11 min-w-[170px] rounded-xl bg-gradient-to-r from-[#1d6bff] to-[#00a3ff] text-base font-semibold text-white shadow-[0_14px_30px_rgba(21,95,245,0.35)] transition-transform duration-200 hover:-translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_18px_34px_rgba(21,95,245,0.38)] active:translate-y-0"
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default InvoiceScanControls;

function ReconnectIntegrationCard({ logoSrc, name }: { logoSrc: string; name: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[340px] items-center justify-center gap-3 rounded-2xl border border-[#dde4f3] bg-white px-5 py-3 shadow-[0_10px_24px_rgba(12,32,72,0.05)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
        <Image src={logoSrc} alt={name} width={36} height={36} className="h-9 w-9 rounded-lg" />
      </span>
      <p className="text-base font-semibold text-[#0a1f44]">{name}</p>
    </div>
  );
}
