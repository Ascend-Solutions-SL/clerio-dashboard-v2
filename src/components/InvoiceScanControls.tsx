'use client';

import React from 'react';
import { AlertTriangle, Check, Loader2, Plug, RefreshCw, ScanSearch, X } from 'lucide-react';
import Image from 'next/image';

import { useDashboardSession } from '@/context/dashboard-session-context';
import { useScanRealtime } from '@/context/scan-realtime-context';
import type { ScanStepRealtimeEventRow } from '@/context/scan-realtime-context';
import { supabase } from '@/lib/supabase';
import { triggerN8nAction } from '@/lib/n8n';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

type InvoiceScanControlsProps = {
  onScanned?: () => void;
  onProgressUpdate?: () => void;
  showHoldedScan?: boolean;
};

type HoldedErrorReason = 'holded_unpaid' | 'holded_error_other' | 'unknown';

type AuthUserScanSettings = {
  email_type: string | null;
};

type ScanRunRow = {
  finished_at: string | null;
};

type ScanStartWebhookResponse = {
  run_id?: string | null;
  user_uid?: string | null;
  scan_type?: string | null;
};

type ScanStepRealtimeRow = {
  id?: string | number | null;
  run_id?: string | number | null;
  user_uid?: string | null;
  step?: string | null;
  provider?: string | null;
  status?: string | null;
  metadata?: unknown;
  progress_total?: number | string | null;
  progress_current?: number | string | null;
  last_updated_at?: string | null;
};

type ScanStatusTone = 'neutral' | 'warning' | 'success';

type ScanStatusQueueItem = {
  key: string;
  text: string;
  tone: ScanStatusTone;
  showSuccessIcon?: boolean;
  stopSpinner?: boolean;
  minVisibleMs?: number;
  onDisplayed?: () => void;
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
  CREDENTIALS_NON_EXISTING: 702,
} as const;

const HOLDED_STATUS_EVENT = 'holded-status-changed';
const SCAN_IN_PROGRESS_EVENT = 'invoice-scan-in-progress-changed';
const SCAN_IN_PROGRESS_STORAGE_KEY = 'invoice-scan-in-progress';
const SCAN_ACTIVE_RUN_ID_STORAGE_KEY = 'invoice-scan-active-run-id';
const SCAN_ACTIVE_USER_UID_STORAGE_KEY = 'invoice-scan-active-user-uid';
const SCAN_ACTIVE_SCAN_TYPE_STORAGE_KEY = 'invoice-scan-active-scan-type';
const HOLDED_SCAN_IN_PROGRESS_EVENT = 'holded-scan-in-progress-changed';
const HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY = 'holded-scan-in-progress';
const HOLDED_SCAN_ACTIVE_RUN_ID_STORAGE_KEY = 'holded-scan-active-run-id';
const HOLDED_SCAN_ACTIVE_USER_UID_STORAGE_KEY = 'holded-scan-active-user-uid';
const SCAN_TOAST_SYNC_STORAGE_KEY = 'invoice-scan-toast-sync';
const SCAN_TOAST_SYNC_LAST_SEEN_STORAGE_KEY = 'invoice-scan-toast-sync-last-seen';
const SCAN_TOAST_SYNC_TAB_ID_STORAGE_KEY = 'invoice-scan-toast-sync-tab-id';
const invoiceScanMetaCache = new Map<string, InvoiceScanMetaCacheEntry>();
const RECONNECT_FLOW_PARAM = 'scanReconnect';
const RECONNECT_STAGE_PARAM = 'scanFlowStage';
const RECONNECT_FLOW_STORAGE_KEY = 'scanReconnectStage';
const CREDENTIALS_MISSING_FLOW_PARAM = 'scanCredentialsMissing';
const CREDENTIALS_MISSING_STAGE_PARAM = 'scanMissingStage';
const CREDENTIALS_MISSING_EMAIL_PARAM = 'scanMissingEmail';
const CREDENTIALS_MISSING_FLOW_STAGE_STORAGE_KEY = 'scanCredentialsMissingStage';
const CREDENTIALS_MISSING_FLOW_EMAIL_STORAGE_KEY = 'scanCredentialsMissingEmail';
const SCAN_TOAST_DURATION_MS = 3000;
const SCAN_TOAST_BASE_CLASS =
  'w-[420px] max-w-[calc(100vw-2rem)] min-h-[104px] data-[state=closed]:slide-out-to-right-0 data-[state=closed]:fade-out-100';
const SCAN_TOAST_SUCCESS_CLASS = `${SCAN_TOAST_BASE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-950`;
const SCAN_TOAST_CLERIO_START_CLASS = `${SCAN_TOAST_BASE_CLASS} border-[#1d6bff] bg-white text-[#0a1f44]`;
const SCAN_TOAST_HOLDED_START_CLASS = `${SCAN_TOAST_BASE_CLASS} border-[#ff4254] bg-white text-[#7f1d24]`;
const SCAN_TOAST_LOGO_SIZE = 40;
const SCAN_TOAST_LOGO_CLASS = 'pointer-events-none absolute right-5 top-1/2 h-10 w-10 -translate-y-1/2 object-contain';
const SCAN_TOAST_DESCRIPTION_CLASS = 'block pr-16';
const SCAN_STEPS_BUFFER_LIMIT = 24;
const SCAN_STATUS_MIN_VISIBLE_MS = 1300;
const SCAN_STATUS_TRANSITION_MS = 150;
const SCAN_STATUS_FINAL_HOLD_MS = 1800;
const SCAN_STATUS_WARNING_HOLD_MS = 3600;

type RevokedModalStage = 'warning' | 'gmail' | 'drive' | 'success';
const REVOKED_MODAL_STAGE_ORDER: ReadonlyArray<RevokedModalStage> = ['warning', 'gmail', 'drive', 'success'];

type MissingCredentialsModalStage = 'warning' | 'email' | 'storage' | 'success';
type EmailProvider = 'gmail' | 'outlook';
const MISSING_CREDENTIALS_MODAL_STAGE_ORDER: ReadonlyArray<MissingCredentialsModalStage> = ['warning', 'email', 'storage', 'success'];
type ScanToastSyncType = 'primary-started' | 'holded-started' | 'primary-finished' | 'holded-finished';

const getStorageProviderForEmail = (emailProvider: EmailProvider): 'drive' | 'onedrive' =>
  emailProvider === 'gmail' ? 'drive' : 'onedrive';

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

const getHoldedErrorReasonFromMetadata = (metadata: unknown): HoldedErrorReason => {
  const readReason = (value: unknown): HoldedErrorReason | null => {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const reason = (value as { reason?: unknown }).reason;
    if (reason === 'holded_unpaid' || reason === 'holded_error_other') {
      return reason;
    }

    return null;
  };

  if (Array.isArray(metadata)) {
    for (const item of metadata) {
      const reason = readReason(item);
      if (reason) {
        return reason;
      }
    }
    return 'unknown';
  }

  return readReason(metadata) ?? 'unknown';
};

type CredentialRefreshErrorReason = 'revoked' | 'non_existing' | 'unknown';

const getCredentialRefreshErrorReasonFromMetadata = (metadata: unknown): CredentialRefreshErrorReason => {
  const readReason = (value: unknown): CredentialRefreshErrorReason | null => {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const reason = (value as { reason?: unknown }).reason;
    if (reason === 'revoked' || reason === 'non_existing') {
      return reason;
    }

    return null;
  };

  if (Array.isArray(metadata)) {
    for (const item of metadata) {
      const reason = readReason(item);
      if (reason) {
        return reason;
      }
    }

    return 'unknown';
  }

  return readReason(metadata) ?? 'unknown';
};

const isCredentialsStepName = (step: string) => step === 'credentials_refresh';

const isCredentialsErrorStep = (step: string, status: string) => {
  return step === 'credentials_refresh' && status === 'error';
};

const isMissingCredentialsError = (step: string, status: string, metadata: unknown) => {
  if (step === 'credentials_refresh' && status === 'error') {
    return getCredentialRefreshErrorReasonFromMetadata(metadata) === 'non_existing';
  }

  return false;
};

const normalizeScanType = (value: unknown): 'gmail' | 'outlook' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'gmail' || normalized === 'outlook') {
    return normalized;
  }

  return null;
};

const getScanStepEventKey = (row: ScanStepRealtimeRow | ScanStepRealtimeEventRow): string | null => {
  const runId = row.run_id != null ? String(row.run_id).trim() : '';
  const step = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
  const provider = typeof row.provider === 'string' ? row.provider.trim().toLowerCase() : '';
  const status = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
  const progressCurrent = toNonNegativeInteger(row.progress_current);
  const progressTotal = toNonNegativeInteger(row.progress_total);
  const updatedAt = typeof row.last_updated_at === 'string' ? row.last_updated_at.trim() : '';

  if (row.id != null && String(row.id).trim().length > 0) {
    return [
      'id',
      String(row.id).trim(),
      updatedAt || '-',
      step || '-',
      provider || '-',
      status || '-',
      progressCurrent ?? '-',
      progressTotal ?? '-',
    ].join(':');
  }

  if (!runId) {
    return null;
  }

  return [
    'fallback',
    runId,
    step || '-',
    provider || '-',
    status || '-',
    progressCurrent ?? '-',
    progressTotal ?? '-',
    updatedAt || '-',
  ].join(':');
};

const toNonNegativeInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? Math.floor(value) : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }

  return null;
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

  if (totalMinutes < 1) {
    return 'un momento';
  }

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

const readScanStorage = (key: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const fromLocal = window.localStorage.getItem(key);
  if (fromLocal != null) {
    return fromLocal;
  }

  return window.sessionStorage.getItem(key);
};

const writeScanStorage = (key: string, value: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (value == null) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, value);
  window.sessionStorage.setItem(key, value);
};

const getOrCreateToastSyncTabId = () => {
  if (typeof window === 'undefined') {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const existing = window.sessionStorage.getItem(SCAN_TOAST_SYNC_TAB_ID_STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const generated = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(SCAN_TOAST_SYNC_TAB_ID_STORAGE_KEY, generated);
  return generated;
};

const getScanInProgress = () => {
  return readScanStorage(SCAN_IN_PROGRESS_STORAGE_KEY) === '1';
};

const setScanInProgress = (inProgress: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (inProgress) {
    writeScanStorage(SCAN_IN_PROGRESS_STORAGE_KEY, '1');
  } else {
    writeScanStorage(SCAN_IN_PROGRESS_STORAGE_KEY, null);
  }

  window.dispatchEvent(new CustomEvent(SCAN_IN_PROGRESS_EVENT, { detail: { inProgress } }));
};

const getActivePrimaryScanRunId = () => {
  const value = readScanStorage(SCAN_ACTIVE_RUN_ID_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
};

const getActivePrimaryScanUserUid = () => {
  const value = readScanStorage(SCAN_ACTIVE_USER_UID_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
};

const getActivePrimaryScanType = () => {
  return normalizeScanType(readScanStorage(SCAN_ACTIVE_SCAN_TYPE_STORAGE_KEY));
};

const setActivePrimaryScanTracking = (runId: string, userUid: string | null, scanType: 'gmail' | 'outlook' | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  writeScanStorage(SCAN_ACTIVE_RUN_ID_STORAGE_KEY, runId);
  if (userUid && userUid.trim().length > 0) {
    writeScanStorage(SCAN_ACTIVE_USER_UID_STORAGE_KEY, userUid);
  } else {
    writeScanStorage(SCAN_ACTIVE_USER_UID_STORAGE_KEY, null);
  }

  if (scanType) {
    writeScanStorage(SCAN_ACTIVE_SCAN_TYPE_STORAGE_KEY, scanType);
  } else {
    writeScanStorage(SCAN_ACTIVE_SCAN_TYPE_STORAGE_KEY, null);
  }

  window.dispatchEvent(new CustomEvent(SCAN_IN_PROGRESS_EVENT));
};

const clearActivePrimaryScanTracking = () => {
  if (typeof window === 'undefined') {
    return;
  }

  writeScanStorage(SCAN_ACTIVE_RUN_ID_STORAGE_KEY, null);
  writeScanStorage(SCAN_ACTIVE_USER_UID_STORAGE_KEY, null);
  writeScanStorage(SCAN_ACTIVE_SCAN_TYPE_STORAGE_KEY, null);
  window.dispatchEvent(new CustomEvent(SCAN_IN_PROGRESS_EVENT));
};

const getHoldedScanInProgress = () => {
  return readScanStorage(HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY) === '1';
};

const setHoldedScanInProgress = (inProgress: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (inProgress) {
    writeScanStorage(HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY, '1');
  } else {
    writeScanStorage(HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY, null);
  }

  window.dispatchEvent(new CustomEvent(HOLDED_SCAN_IN_PROGRESS_EVENT, { detail: { inProgress } }));
};

const getActiveHoldedScanRunId = () => {
  const value = readScanStorage(HOLDED_SCAN_ACTIVE_RUN_ID_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
};

const getActiveHoldedScanUserUid = () => {
  const value = readScanStorage(HOLDED_SCAN_ACTIVE_USER_UID_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
};

const setActiveHoldedScanTracking = (runId: string, userUid: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  writeScanStorage(HOLDED_SCAN_ACTIVE_RUN_ID_STORAGE_KEY, runId);
  if (userUid && userUid.trim().length > 0) {
    writeScanStorage(HOLDED_SCAN_ACTIVE_USER_UID_STORAGE_KEY, userUid);
  } else {
    writeScanStorage(HOLDED_SCAN_ACTIVE_USER_UID_STORAGE_KEY, null);
  }

  window.dispatchEvent(new CustomEvent(HOLDED_SCAN_IN_PROGRESS_EVENT));
};

const clearActiveHoldedScanTracking = () => {
  if (typeof window === 'undefined') {
    return;
  }

  writeScanStorage(HOLDED_SCAN_ACTIVE_RUN_ID_STORAGE_KEY, null);
  writeScanStorage(HOLDED_SCAN_ACTIVE_USER_UID_STORAGE_KEY, null);
  window.dispatchEvent(new CustomEvent(HOLDED_SCAN_IN_PROGRESS_EVENT));
};

export function InvoiceScanControls({ onScanned, onProgressUpdate, showHoldedScan = false }: InvoiceScanControlsProps) {
  const { user } = useDashboardSession();
  const {
    locksHydrated,
    primaryScopeLocked,
    holdedScopeLocked,
    primaryRunningRunId,
    primaryRunningScanType,
    holdedRunningRunId,
    scanStepsVersion,
    getBufferedScanStepsForRun,
    getLatestBufferedNonCredentialStepForRun,
  } = useScanRealtime();
  const { toast } = useToast();
  const isAnyScopeLocked = primaryScopeLocked || holdedScopeLocked;
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
  const [showCredentialsMissingModal, setShowCredentialsMissingModal] = React.useState(false);
  const [missingCredentialsModalStage, setMissingCredentialsModalStage] = React.useState<MissingCredentialsModalStage>('warning');
  const [missingEmailProvider, setMissingEmailProvider] = React.useState<EmailProvider | null>(null);
  const [showHoldedErrorModal, setShowHoldedErrorModal] = React.useState(false);
  const [holdedErrorReason, setHoldedErrorReason] = React.useState<HoldedErrorReason>('unknown');
  const [isRedirectingToOAuth, setIsRedirectingToOAuth] = React.useState(false);
  const [activeScanRunId, setActiveScanRunId] = React.useState<string | null>(() => getActivePrimaryScanRunId());
  const [activeScanUserUid, setActiveScanUserUid] = React.useState<string | null>(() => getActivePrimaryScanUserUid());
  const [activeScanType, setActiveScanType] = React.useState<'gmail' | 'outlook' | null>(() => getActivePrimaryScanType());
  const [activeHoldedScanRunId, setActiveHoldedScanRunId] = React.useState<string | null>(() => getActiveHoldedScanRunId());
  const [activeHoldedScanUserUid, setActiveHoldedScanUserUid] = React.useState<string | null>(() => getActiveHoldedScanUserUid());
  const [scanStatusMessage, setScanStatusMessage] = React.useState<ScanStatusQueueItem | null>(null);
  const [isScanStatusVisible, setIsScanStatusVisible] = React.useState(true);
  const [stopStatusSpinner, setStopStatusSpinner] = React.useState(false);
  const completedRunToastRef = React.useRef<string | null>(null);
  const completedHoldedRunToastRef = React.useRef<string | null>(null);
  const credentialsFailedRunRef = React.useRef<string | null>(null);
  const holdedErrorRunRef = React.useRef<string | null>(null);
  const activeScanRunIdRef = React.useRef<string | null>(activeScanRunId);
  const activeScanUserUidRef = React.useRef<string | null>(activeScanUserUid);
  const activeScanTypeRef = React.useRef<'gmail' | 'outlook' | null>(activeScanType);
  const activeHoldedScanRunIdRef = React.useRef<string | null>(activeHoldedScanRunId);
  const activeHoldedScanUserUidRef = React.useRef<string | null>(activeHoldedScanUserUid);
  const scanStepBufferRef = React.useRef<Map<string, ScanStepRealtimeRow[]>>(new Map());
  const invoiceProcessingTotalRef = React.useRef<number | null>(null);
  const holdedProcessingTotalRef = React.useRef<number | null>(null);
  const scanStatusQueueRef = React.useRef<ScanStatusQueueItem[]>([]);
  const scanStatusTimerRef = React.useRef<number | null>(null);
  const scanStatusSwapTimerRef = React.useRef<number | null>(null);
  const scanStatusWarningTimerRef = React.useRef<number | null>(null);
  const scanStatusIdleResetTimerRef = React.useRef<number | null>(null);
  const scanStatusMinVisibleMsRef = React.useRef<number>(SCAN_STATUS_MIN_VISIBLE_MS);
  const scanStatusShownAtRef = React.useRef<number>(0);
  const currentScanStatusKeyRef = React.useRef<string | null>(null);
  const scanStatusQueueProcessorRef = React.useRef<() => void>(() => undefined);
  const scanCompletionTimerRef = React.useRef<number | null>(null);
  const lockBootstrapReconciledRef = React.useRef(false);
  const processedPrimaryStepEventKeysRef = React.useRef<Set<string>>(new Set());
  const processedHoldedStepEventKeysRef = React.useRef<Set<string>>(new Set());
  const lastPrimaryRunForProcessedStepsRef = React.useRef<string | null>(null);
  const lastHoldedRunForProcessedStepsRef = React.useRef<string | null>(null);
  const holdedCredentialsSuccessRunsRef = React.useRef<Set<string>>(new Set());
  const holdedScrapperStartRunsRef = React.useRef<Set<string>>(new Set());
  const holdedConnectingShownRunsRef = React.useRef<Set<string>>(new Set());
  const onScannedRef = React.useRef<InvoiceScanControlsProps['onScanned']>(onScanned);
  const onProgressUpdateRef = React.useRef<InvoiceScanControlsProps['onProgressUpdate']>(onProgressUpdate);
  const toastRef = React.useRef(toast);
  const [tabId] = React.useState(getOrCreateToastSyncTabId);

  React.useEffect(() => {
    onScannedRef.current = onScanned;
  }, [onScanned]);

  React.useEffect(() => {
    onProgressUpdateRef.current = onProgressUpdate;
  }, [onProgressUpdate]);

  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const showSyncedToast = React.useCallback((type: ScanToastSyncType) => {
    if (type === 'holded-started') {
      toastRef.current({
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
      return;
    }

    if (type === 'primary-finished') {
      toastRef.current({
        title: 'Escaneo finalizado',
        description: 'Se ha finalizado el escaneo de facturas.',
        duration: SCAN_TOAST_DURATION_MS,
        className: SCAN_TOAST_SUCCESS_CLASS,
      });
      return;
    }

    if (type === 'holded-finished') {
      toastRef.current({
        title: 'Escaneo finalizado',
        description: 'Se ha finalizado el escaneo de facturas de Holded.',
        duration: SCAN_TOAST_DURATION_MS,
        className: SCAN_TOAST_SUCCESS_CLASS,
      });
      return;
    }

    toastRef.current({
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
  }, []);

  const broadcastToast = React.useCallback(
    (type: ScanToastSyncType) => {
      if (typeof window === 'undefined') {
        return;
      }

      try {
        window.localStorage.setItem(
          SCAN_TOAST_SYNC_STORAGE_KEY,
          JSON.stringify({
            type,
            sourceTabId: tabId,
            emittedAt: Date.now(),
          })
        );
      } catch {
        // noop
      }
    },
    [tabId]
  );

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SCAN_TOAST_SYNC_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        const payload = JSON.parse(event.newValue) as {
          type?: unknown;
          sourceTabId?: unknown;
          emittedAt?: unknown;
        };

        if (payload.sourceTabId === tabId) {
          return;
        }

        if (
          payload.type === 'primary-started' ||
          payload.type === 'holded-started' ||
          payload.type === 'primary-finished' ||
          payload.type === 'holded-finished'
        ) {
          try {
            if (typeof payload.emittedAt === 'number') {
              window.sessionStorage.setItem(SCAN_TOAST_SYNC_LAST_SEEN_STORAGE_KEY, String(payload.emittedAt));
            }
          } catch {
            // noop
          }
          showSyncedToast(payload.type);
        }
      } catch {
        // noop
      }
    };

    window.addEventListener('storage', handleStorage);

    try {
      const raw = window.localStorage.getItem(SCAN_TOAST_SYNC_STORAGE_KEY);
      if (raw) {
        const payload = JSON.parse(raw) as {
          type?: unknown;
          sourceTabId?: unknown;
          emittedAt?: unknown;
        };
        const emittedAt = typeof payload.emittedAt === 'number' ? payload.emittedAt : 0;
        const lastSeen = Number(window.sessionStorage.getItem(SCAN_TOAST_SYNC_LAST_SEEN_STORAGE_KEY) ?? '0');
        const isRecent = emittedAt > 0 && Date.now() - emittedAt < 12000;
        const shouldShow = emittedAt > lastSeen && isRecent;
        if (
          shouldShow &&
          payload.sourceTabId !== tabId &&
          (payload.type === 'primary-started' ||
            payload.type === 'holded-started' ||
            payload.type === 'primary-finished' ||
            payload.type === 'holded-finished')
        ) {
          window.sessionStorage.setItem(SCAN_TOAST_SYNC_LAST_SEEN_STORAGE_KEY, String(emittedAt));
          showSyncedToast(payload.type);
        }
      }
    } catch {
      // noop
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [showSyncedToast, tabId]);

  React.useEffect(() => {
    activeScanRunIdRef.current = activeScanRunId;
  }, [activeScanRunId]);

  React.useEffect(() => {
    activeScanUserUidRef.current = activeScanUserUid;
  }, [activeScanUserUid]);

  React.useEffect(() => {
    activeScanTypeRef.current = activeScanType;
  }, [activeScanType]);

  React.useEffect(() => {
    activeHoldedScanRunIdRef.current = activeHoldedScanRunId;
  }, [activeHoldedScanRunId]);

  React.useEffect(() => {
    activeHoldedScanUserUidRef.current = activeHoldedScanUserUid;
  }, [activeHoldedScanUserUid]);

  const clearScanStatusTimers = React.useCallback(() => {
    if (scanStatusTimerRef.current !== null) {
      window.clearTimeout(scanStatusTimerRef.current);
      scanStatusTimerRef.current = null;
    }

    if (scanStatusSwapTimerRef.current !== null) {
      window.clearTimeout(scanStatusSwapTimerRef.current);
      scanStatusSwapTimerRef.current = null;
    }

    if (scanStatusWarningTimerRef.current !== null) {
      window.clearTimeout(scanStatusWarningTimerRef.current);
      scanStatusWarningTimerRef.current = null;
    }

    if (scanStatusIdleResetTimerRef.current !== null) {
      window.clearTimeout(scanStatusIdleResetTimerRef.current);
      scanStatusIdleResetTimerRef.current = null;
    }

    if (scanCompletionTimerRef.current !== null) {
      window.clearTimeout(scanCompletionTimerRef.current);
      scanCompletionTimerRef.current = null;
    }
  }, []);

  const scheduleStatusFallbackToLastScan = React.useCallback((statusKey: string) => {
    if (scanStatusWarningTimerRef.current !== null) {
      window.clearTimeout(scanStatusWarningTimerRef.current);
      scanStatusWarningTimerRef.current = null;
    }

    scanStatusWarningTimerRef.current = window.setTimeout(() => {
      scanStatusWarningTimerRef.current = null;
      if (currentScanStatusKeyRef.current !== statusKey) {
        return;
      }

      currentScanStatusKeyRef.current = null;
      scanStatusShownAtRef.current = 0;
      setScanStatusMessage(null);
      setIsScanStatusVisible(true);
      setStopStatusSpinner(false);
    }, SCAN_STATUS_WARNING_HOLD_MS);
  }, []);

  const clearHoldedRunRealtimeMarkers = React.useCallback((runId: string | null) => {
    if (!runId) {
      return;
    }

    holdedCredentialsSuccessRunsRef.current.delete(runId);
    holdedScrapperStartRunsRef.current.delete(runId);
    holdedConnectingShownRunsRef.current.delete(runId);
  }, []);

  const setMissingCredentialsFlowState = React.useCallback(
    (stage: 'email' | 'storage' | 'success' | null, emailProvider: EmailProvider | null) => {
      if (typeof window === 'undefined') {
        return;
      }

      try {
        if (!stage) {
          window.sessionStorage.removeItem(CREDENTIALS_MISSING_FLOW_STAGE_STORAGE_KEY);
          window.sessionStorage.removeItem(CREDENTIALS_MISSING_FLOW_EMAIL_STORAGE_KEY);
          return;
        }

        window.sessionStorage.setItem(CREDENTIALS_MISSING_FLOW_STAGE_STORAGE_KEY, stage);
        if (emailProvider) {
          window.sessionStorage.setItem(CREDENTIALS_MISSING_FLOW_EMAIL_STORAGE_KEY, emailProvider);
        } else {
          window.sessionStorage.removeItem(CREDENTIALS_MISSING_FLOW_EMAIL_STORAGE_KEY);
        }
      } catch {
        // noop
      }
    },
    []
  );

  const getMissingCredentialsFlowStage = React.useCallback((): 'email' | 'storage' | 'success' | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const value = window.sessionStorage.getItem(CREDENTIALS_MISSING_FLOW_STAGE_STORAGE_KEY);
      if (value === 'email' || value === 'storage' || value === 'success') {
        return value;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const getMissingCredentialsFlowEmail = React.useCallback((): EmailProvider | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const value = window.sessionStorage.getItem(CREDENTIALS_MISSING_FLOW_EMAIL_STORAGE_KEY);
      if (value === 'gmail' || value === 'outlook') {
        return value;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const resetScanStatusUI = React.useCallback(() => {
    clearScanStatusTimers();
    scanStatusQueueRef.current = [];
    scanStatusMinVisibleMsRef.current = SCAN_STATUS_MIN_VISIBLE_MS;
    scanStatusShownAtRef.current = 0;
    currentScanStatusKeyRef.current = null;
    setScanStatusMessage(null);
    setIsScanStatusVisible(true);
    setStopStatusSpinner(false);
    invoiceProcessingTotalRef.current = null;
    holdedProcessingTotalRef.current = null;
  }, [clearScanStatusTimers]);

  const applyScanStatus = React.useCallback((item: ScanStatusQueueItem) => {
    setIsScanStatusVisible(false);

    if (scanStatusSwapTimerRef.current !== null) {
      window.clearTimeout(scanStatusSwapTimerRef.current);
      scanStatusSwapTimerRef.current = null;
    }

    scanStatusSwapTimerRef.current = window.setTimeout(() => {
      scanStatusSwapTimerRef.current = null;
      setScanStatusMessage(item);
      setStopStatusSpinner(Boolean(item.stopSpinner));
      setIsScanStatusVisible(true);
      scanStatusMinVisibleMsRef.current =
        typeof item.minVisibleMs === 'number' && item.minVisibleMs > 0 ? item.minVisibleMs : SCAN_STATUS_MIN_VISIBLE_MS;
      scanStatusShownAtRef.current = Date.now();
      currentScanStatusKeyRef.current = item.key;
      item.onDisplayed?.();
      scanStatusQueueProcessorRef.current();
    }, SCAN_STATUS_TRANSITION_MS);
  }, []);

  scanStatusQueueProcessorRef.current = () => {
    if (scanStatusTimerRef.current !== null) {
      return;
    }

    if (scanStatusSwapTimerRef.current !== null) {
      return;
    }

    if (scanStatusQueueRef.current.length === 0) {
      return;
    }

    const elapsed = Date.now() - scanStatusShownAtRef.current;
    const minVisibleMs = scanStatusShownAtRef.current === 0 ? 0 : scanStatusMinVisibleMsRef.current;
    const waitMs = scanStatusShownAtRef.current === 0 ? 0 : Math.max(0, minVisibleMs - elapsed);

    scanStatusTimerRef.current = window.setTimeout(() => {
      scanStatusTimerRef.current = null;
      const next = scanStatusQueueRef.current.shift();
      if (!next) {
        return;
      }

      applyScanStatus(next);
    }, waitMs);
  };

  const enqueueScanStatus = React.useCallback(
    (
      item: ScanStatusQueueItem,
      options?: {
        immediate?: boolean;
        replacePending?: boolean;
      }
    ) => {
      const immediate = Boolean(options?.immediate);
      const replacePending = Boolean(options?.replacePending);

      if (replacePending) {
        scanStatusQueueRef.current = [];
      }

      const lastQueuedKey = scanStatusQueueRef.current[scanStatusQueueRef.current.length - 1]?.key ?? null;
      const isSameAsCurrent = currentScanStatusKeyRef.current === item.key;
      const isSameAsLastQueued = lastQueuedKey === item.key;

      if (!immediate && (isSameAsCurrent || isSameAsLastQueued)) {
        return;
      }

      if (immediate) {
        if (scanStatusTimerRef.current !== null) {
          window.clearTimeout(scanStatusTimerRef.current);
          scanStatusTimerRef.current = null;
        }
        applyScanStatus(item);
        return;
      }

      scanStatusQueueRef.current.push(item);
      scanStatusQueueProcessorRef.current();
    },
    [applyScanStatus]
  );

  const tryEnqueueHoldedConnectingStatus = React.useCallback(
    (runId: string) => {
      if (
        holdedConnectingShownRunsRef.current.has(runId) ||
        !holdedCredentialsSuccessRunsRef.current.has(runId) ||
        !holdedScrapperStartRunsRef.current.has(runId)
      ) {
        return;
      }

      holdedConnectingShownRunsRef.current.add(runId);
      enqueueScanStatus({
        key: `holded-start-${runId}`,
        text: 'Conectando con Holded...',
        tone: 'neutral',
      });
    },
    [enqueueScanStatus]
  );

  React.useEffect(() => {
    return () => {
      clearScanStatusTimers();
    };
  }, [clearScanStatusTimers]);

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

    const [{ data: authUser, error: authUserError }, { data: lastRun, error: runError }, holdedStatusResult] =
      await Promise.all([
        supabase
          .from('auth_users')
          .select('email_type')
          .eq('user_uid', user.id)
          .maybeSingle(),
        supabase
          .from('scan_runs')
          .select('finished_at')
          .eq('user_uid', user.id)
          .eq('status', 'success')
          .in('scan_type', ['gmail', 'outlook', 'holded_invoice_scan'])
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
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

    if (runError) {
      console.error('Error fetching last scan run', runError);
    }

    const typedAuthUser = authUser as AuthUserScanSettings | null;
    const typedLastRun = lastRun as ScanRunRow | null;

    const nextEmailType = authUserError ? (cached?.emailType ?? null) : typedAuthUser?.email_type?.trim() || null;
    const nextLastScanAt = runError ? (cached?.lastScanAt ?? null) : typedLastRun?.finished_at ?? null;

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

  const loadScanMetaRef = React.useRef(loadScanMeta);

  React.useEffect(() => {
    loadScanMetaRef.current = loadScanMeta;
  }, [loadScanMeta]);

  React.useEffect(() => {
    void loadScanMeta();
  }, [loadScanMeta]);

  React.useEffect(() => {
    if (!user?.id || !locksHydrated || lockBootstrapReconciledRef.current) {
      return;
    }

    if (!primaryScopeLocked) {
      clearActivePrimaryScanTracking();
      setScanInProgress(false);
      setActiveScanRunId(null);
      setActiveScanUserUid(null);
      setActiveScanType(null);
    }

    if (!holdedScopeLocked) {
      clearActiveHoldedScanTracking();
      setHoldedScanInProgress(false);
      setActiveHoldedScanRunId(null);
      setActiveHoldedScanUserUid(null);
    }

    lockBootstrapReconciledRef.current = true;
  }, [holdedScopeLocked, locksHydrated, primaryScopeLocked, user?.id]);

  React.useEffect(() => {
    if (!user?.id || !primaryScopeLocked) {
      return;
    }

    if (!primaryRunningRunId) {
      return;
    }

    const nextScanType = primaryRunningScanType ?? activeScanTypeRef.current;
    if (!nextScanType) {
      return;
    }

    setScanInProgress(true);
    setActivePrimaryScanTracking(primaryRunningRunId, user.id, nextScanType);
    setActiveScanRunId(primaryRunningRunId);
    setActiveScanUserUid(user.id);
    setActiveScanType(nextScanType);
  }, [primaryRunningRunId, primaryRunningScanType, primaryScopeLocked, user?.id]);

  React.useEffect(() => {
    if (!user?.id || !holdedScopeLocked) {
      return;
    }

    if (!holdedRunningRunId) {
      return;
    }

    setHoldedScanInProgress(true);
    setActiveHoldedScanTracking(holdedRunningRunId, user.id);
    setActiveHoldedScanRunId(holdedRunningRunId);
    setActiveHoldedScanUserUid(user.id);
  }, [holdedRunningRunId, holdedScopeLocked, user?.id]);

  React.useEffect(() => {
    if (!scanStepsVersion) {
      return;
    }

    const primaryRunId = activeScanRunIdRef.current;
    if (primaryRunId) {
      const buffered = getBufferedScanStepsForRun(primaryRunId);
      if (buffered.length > 0) {
        scanStepBufferRef.current.set(primaryRunId, buffered.slice(-SCAN_STEPS_BUFFER_LIMIT) as ScanStepRealtimeRow[]);
      }
    }

    const holdedRunId = activeHoldedScanRunIdRef.current;
    if (holdedRunId) {
      const buffered = getBufferedScanStepsForRun(holdedRunId);
      if (buffered.length > 0) {
        scanStepBufferRef.current.set(holdedRunId, buffered.slice(-SCAN_STEPS_BUFFER_LIMIT) as ScanStepRealtimeRow[]);
      }
    }
  }, [getBufferedScanStepsForRun, scanStepsVersion]);

  React.useEffect(() => {
    const handleScanInProgressChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ inProgress?: boolean }>;
      if (typeof customEvent.detail?.inProgress === 'boolean') {
        setIsScanInProgress(customEvent.detail.inProgress);
        if (customEvent.detail.inProgress) {
          setActiveScanRunId(getActivePrimaryScanRunId());
          setActiveScanUserUid(getActivePrimaryScanUserUid());
          setActiveScanType(getActivePrimaryScanType());
        } else {
          setActiveScanRunId(null);
          setActiveScanUserUid(null);
          setActiveScanType(null);
        }
        return;
      }

      setIsScanInProgress(getScanInProgress());
      setActiveScanRunId(getActivePrimaryScanRunId());
      setActiveScanUserUid(getActivePrimaryScanUserUid());
      setActiveScanType(getActivePrimaryScanType());
    };

    setIsScanInProgress(getScanInProgress());
    setActiveScanRunId(getActivePrimaryScanRunId());
    setActiveScanUserUid(getActivePrimaryScanUserUid());
    setActiveScanType(getActivePrimaryScanType());
    window.addEventListener(SCAN_IN_PROGRESS_EVENT, handleScanInProgressChange);

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === SCAN_IN_PROGRESS_STORAGE_KEY ||
        event.key === SCAN_ACTIVE_RUN_ID_STORAGE_KEY ||
        event.key === SCAN_ACTIVE_USER_UID_STORAGE_KEY ||
        event.key === SCAN_ACTIVE_SCAN_TYPE_STORAGE_KEY
      ) {
        handleScanInProgressChange(new CustomEvent(SCAN_IN_PROGRESS_EVENT));
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(SCAN_IN_PROGRESS_EVENT, handleScanInProgressChange);
      window.removeEventListener('storage', handleStorage);
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
    const handleInProgressChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ inProgress?: boolean }>;
      if (typeof customEvent.detail?.inProgress === 'boolean') {
        setIsHoldedScanInProgress(customEvent.detail.inProgress);
        if (customEvent.detail.inProgress) {
          setActiveHoldedScanRunId(getActiveHoldedScanRunId());
          setActiveHoldedScanUserUid(getActiveHoldedScanUserUid());
        } else {
          setActiveHoldedScanRunId(null);
          setActiveHoldedScanUserUid(null);
        }
        return;
      }

      setIsHoldedScanInProgress(getHoldedScanInProgress());
      setActiveHoldedScanRunId(getActiveHoldedScanRunId());
      setActiveHoldedScanUserUid(getActiveHoldedScanUserUid());
    };

    setIsHoldedScanInProgress(getHoldedScanInProgress());
    setActiveHoldedScanRunId(getActiveHoldedScanRunId());
    setActiveHoldedScanUserUid(getActiveHoldedScanUserUid());
    window.addEventListener(HOLDED_SCAN_IN_PROGRESS_EVENT, handleInProgressChange);

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY ||
        event.key === HOLDED_SCAN_ACTIVE_RUN_ID_STORAGE_KEY ||
        event.key === HOLDED_SCAN_ACTIVE_USER_UID_STORAGE_KEY
      ) {
        handleInProgressChange(new CustomEvent(HOLDED_SCAN_IN_PROGRESS_EVENT));
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(HOLDED_SCAN_IN_PROGRESS_EVENT, handleInProgressChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

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

  const closeMissingCredentialsModal = React.useCallback(() => {
    setShowCredentialsMissingModal(false);
    setMissingCredentialsModalStage('warning');
    setMissingEmailProvider(null);
    setIsRedirectingToOAuth(false);
    setMissingCredentialsFlowState(null, null);
  }, [setMissingCredentialsFlowState]);

  const closeHoldedErrorModal = React.useCallback(() => {
    setShowHoldedErrorModal(false);
    setHoldedErrorReason('unknown');
  }, []);

  const buildMissingCredentialsRedirectPath = React.useCallback(
    (stage: 'email' | 'storage' | 'success', emailProvider: EmailProvider) => {
      const redirectUrl = new URL(window.location.href);
      redirectUrl.searchParams.set(CREDENTIALS_MISSING_FLOW_PARAM, '1');
      redirectUrl.searchParams.set(CREDENTIALS_MISSING_STAGE_PARAM, stage);
      redirectUrl.searchParams.set(CREDENTIALS_MISSING_EMAIL_PARAM, emailProvider);

      redirectUrl.searchParams.delete(RECONNECT_FLOW_PARAM);
      redirectUrl.searchParams.delete(RECONNECT_STAGE_PARAM);
      redirectUrl.searchParams.delete('skipDriveIntegrationWebhook');
      redirectUrl.searchParams.delete('gmail');
      redirectUrl.searchParams.delete('outlook');
      redirectUrl.searchParams.delete('drive');
      redirectUrl.searchParams.delete('onedrive');
      redirectUrl.searchParams.delete('reason');

      return `${redirectUrl.pathname}${redirectUrl.search}`;
    },
    []
  );

  const handleMissingCredentialsEmailConnect = React.useCallback(() => {
    if (!missingEmailProvider) {
      return;
    }

    setIsRedirectingToOAuth(true);
    setReconnectFlowStage(null);
    setMissingCredentialsFlowState('storage', missingEmailProvider);

    const oauthPath =
      missingEmailProvider === 'gmail' ? '/api/gmail/oauth/start' : '/api/oauth/outlook/start';
    const url = new URL(oauthPath, window.location.origin);
    url.searchParams.set('redirect', buildMissingCredentialsRedirectPath('storage', missingEmailProvider));
    window.location.href = url.toString();
  }, [buildMissingCredentialsRedirectPath, missingEmailProvider, setMissingCredentialsFlowState, setReconnectFlowStage]);

  const handleMissingCredentialsStorageConnect = React.useCallback(() => {
    if (!missingEmailProvider) {
      return;
    }

    const storageProvider = getStorageProviderForEmail(missingEmailProvider);
    const oauthPath = storageProvider === 'drive' ? '/api/drive/oauth/start' : '/api/oauth/onedrive/start';

    setIsRedirectingToOAuth(true);
    setReconnectFlowStage(null);
    setMissingCredentialsFlowState('success', missingEmailProvider);
    const url = new URL(oauthPath, window.location.origin);
    url.searchParams.set('redirect', buildMissingCredentialsRedirectPath('success', missingEmailProvider));
    window.location.href = url.toString();
  }, [buildMissingCredentialsRedirectPath, missingEmailProvider, setMissingCredentialsFlowState, setReconnectFlowStage]);

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
    const missingStageFromStorage = getMissingCredentialsFlowStage();
    const isReconnectFlow = currentUrl.searchParams.get(RECONNECT_FLOW_PARAM) === '1' || Boolean(stageFromStorage);
    const isMissingFlow =
      currentUrl.searchParams.get(CREDENTIALS_MISSING_FLOW_PARAM) === '1' || Boolean(missingStageFromStorage);

    if (isMissingFlow) {
      return;
    }

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
  }, [
    getMissingCredentialsFlowStage,
    getReconnectFlowStage,
    setReconnectFlowStage,
    toast,
  ]);

  React.useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const stageFromStorage = getMissingCredentialsFlowStage();
    const emailFromStorage = getMissingCredentialsFlowEmail();
    const isMissingFlow =
      currentUrl.searchParams.get(CREDENTIALS_MISSING_FLOW_PARAM) === '1' || Boolean(stageFromStorage);

    if (!isMissingFlow) {
      return;
    }

    const stageParam = currentUrl.searchParams.get(CREDENTIALS_MISSING_STAGE_PARAM);
    const stageCandidate =
      stageParam === 'email' || stageParam === 'storage' || stageParam === 'success'
        ? stageParam
        : stageFromStorage;
    const emailParam = currentUrl.searchParams.get(CREDENTIALS_MISSING_EMAIL_PARAM);
    const providerCandidate =
      emailParam === 'gmail' || emailParam === 'outlook' ? emailParam : emailFromStorage;
    const gmailStatus = currentUrl.searchParams.get('gmail');
    const outlookStatus = currentUrl.searchParams.get('outlook');
    const driveStatus = currentUrl.searchParams.get('drive');
    const onedriveStatus = currentUrl.searchParams.get('onedrive');
    const reason = currentUrl.searchParams.get('reason');

    const resolvedProvider = providerCandidate === 'gmail' || providerCandidate === 'outlook' ? providerCandidate : null;

    setShowCredentialsMissingModal(true);
    setIsRedirectingToOAuth(false);
    setReconnectFlowStage(null);
    if (resolvedProvider) {
      setMissingEmailProvider(resolvedProvider);
    }

    if (resolvedProvider && stageCandidate === 'success') {
      const storageStatus = resolvedProvider === 'gmail' ? driveStatus : onedriveStatus;
      if (storageStatus === 'error') {
        setMissingCredentialsFlowState('storage', resolvedProvider);
        setMissingCredentialsModalStage('storage');
        toast({
          title: resolvedProvider === 'gmail' ? 'No se pudo conectar Google Drive' : 'No se pudo conectar OneDrive',
          description: reason || 'Inténtalo de nuevo.',
          variant: 'destructive',
        });
      } else {
        setMissingCredentialsFlowState('success', resolvedProvider);
        setMissingCredentialsModalStage('success');
      }
    } else if (resolvedProvider && stageCandidate === 'storage') {
      const emailStatus = resolvedProvider === 'gmail' ? gmailStatus : outlookStatus;
      if (emailStatus === 'success' || emailStatus == null) {
        setMissingCredentialsFlowState('storage', resolvedProvider);
        setMissingCredentialsModalStage('storage');
      } else {
        setMissingCredentialsFlowState('email', resolvedProvider);
        setMissingCredentialsModalStage('email');
        toast({
          title: resolvedProvider === 'gmail' ? 'No se pudo conectar Gmail' : 'No se pudo conectar Outlook',
          description: reason || 'Inténtalo de nuevo.',
          variant: 'destructive',
        });
      }
    } else {
      setMissingCredentialsFlowState('email', resolvedProvider);
      setMissingCredentialsModalStage('email');
    }

    currentUrl.searchParams.delete(CREDENTIALS_MISSING_FLOW_PARAM);
    currentUrl.searchParams.delete(CREDENTIALS_MISSING_STAGE_PARAM);
    currentUrl.searchParams.delete(CREDENTIALS_MISSING_EMAIL_PARAM);
    currentUrl.searchParams.delete('gmail');
    currentUrl.searchParams.delete('outlook');
    currentUrl.searchParams.delete('drive');
    currentUrl.searchParams.delete('onedrive');
    currentUrl.searchParams.delete('reason');
    window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }, [
    getMissingCredentialsFlowEmail,
    getMissingCredentialsFlowStage,
    setMissingCredentialsFlowState,
    setReconnectFlowStage,
    toast,
  ]);

  const finishPrimaryScan = React.useCallback((runId: string) => {
    if (completedRunToastRef.current === runId) {
      return;
    }

    completedRunToastRef.current = runId;
    credentialsFailedRunRef.current = null;
    clearActivePrimaryScanTracking();
    scanStepBufferRef.current.delete(runId);
    activeScanRunIdRef.current = null;
    activeScanUserUidRef.current = null;
    activeScanTypeRef.current = null;
    setActiveScanRunId(null);
    setActiveScanUserUid(null);
    setActiveScanType(null);
    setLoading(false);
    setScanInProgress(false);
    setLastScanAt(new Date().toISOString());
    resetScanStatusUI();
    onScannedRef.current?.();
    window.setTimeout(() => {
      void loadScanMetaRef.current();
    }, 1200);
  }, [resetScanStatusUI]);

  const finishHoldedScan = React.useCallback((runId: string) => {
    if (completedHoldedRunToastRef.current === runId) {
      return;
    }

    completedHoldedRunToastRef.current = runId;
    clearHoldedRunRealtimeMarkers(runId);
    clearActiveHoldedScanTracking();
    scanStepBufferRef.current.delete(runId);
    activeHoldedScanRunIdRef.current = null;
    activeHoldedScanUserUidRef.current = null;
    setActiveHoldedScanRunId(null);
    setActiveHoldedScanUserUid(null);
    setHoldedLoading(false);
    setHoldedScanInProgress(false);
    setIsHoldedScanInProgress(false);
    setLastScanAt(new Date().toISOString());
    resetScanStatusUI();
    onScannedRef.current?.();
    window.setTimeout(() => {
      void loadScanMetaRef.current();
    }, 1200);
  }, [clearHoldedRunRealtimeMarkers, resetScanStatusUI]);

  React.useEffect(() => {
    if (!locksHydrated || primaryScopeLocked) {
      return;
    }

    if (getScanInProgress()) {
      return;
    }

    const runId = activeScanRunIdRef.current;
    if (!runId) {
      return;
    }

    finishPrimaryScan(runId);
  }, [finishPrimaryScan, locksHydrated, primaryScopeLocked]);

  const stopPrimaryScanForCredentials = React.useCallback((runId: string) => {
    if (credentialsFailedRunRef.current === runId) {
      return;
    }

    credentialsFailedRunRef.current = runId;

    enqueueScanStatus(
      {
        key: `credentials-failed-${runId}`,
        text: 'Credenciales caducadas',
        tone: 'warning',
        stopSpinner: true,
        onDisplayed: () => {
          scheduleStatusFallbackToLastScan(`credentials-failed-${runId}`);
        },
      },
      { immediate: true, replacePending: true }
    );

    clearActivePrimaryScanTracking();
    scanStepBufferRef.current.delete(runId);
    activeScanRunIdRef.current = null;
    activeScanUserUidRef.current = null;
    activeScanTypeRef.current = null;
    setActiveScanRunId(null);
    setActiveScanUserUid(null);
    setActiveScanType(null);
    setLoading(false);
    setScanInProgress(false);
    setIsRedirectingToOAuth(false);
    setRevokedModalStage('warning');
    setReconnectFlowStage(null);
    setShowCredentialsRevokedModal(true);
  }, [enqueueScanStatus, scheduleStatusFallbackToLastScan, setReconnectFlowStage]);

  const stopPrimaryScanForMissingCredentials = React.useCallback((runId: string) => {
    if (credentialsFailedRunRef.current === runId) {
      return;
    }

    credentialsFailedRunRef.current = runId;

    enqueueScanStatus(
      {
        key: `credentials-missing-${runId}`,
        text: 'Integración requerida',
        tone: 'warning',
        stopSpinner: true,
        onDisplayed: () => {
          scheduleStatusFallbackToLastScan(`credentials-missing-${runId}`);
        },
      },
      { immediate: true, replacePending: true }
    );

    clearActivePrimaryScanTracking();
    scanStepBufferRef.current.delete(runId);
    activeScanRunIdRef.current = null;
    activeScanUserUidRef.current = null;
    activeScanTypeRef.current = null;
    setActiveScanRunId(null);
    setActiveScanUserUid(null);
    setActiveScanType(null);
    setLoading(false);
    setScanInProgress(false);
    setIsRedirectingToOAuth(false);
    setMissingCredentialsModalStage('warning');
    setMissingEmailProvider(null);
    setReconnectFlowStage(null);
    setMissingCredentialsFlowState(null, null);
    setShowCredentialsMissingModal(true);
  }, [enqueueScanStatus, scheduleStatusFallbackToLastScan, setMissingCredentialsFlowState, setReconnectFlowStage]);

  const stopHoldedScanForCredentials = React.useCallback((runId: string) => {
    if (credentialsFailedRunRef.current === runId) {
      return;
    }

    credentialsFailedRunRef.current = runId;

    enqueueScanStatus(
      {
        key: `holded-credentials-failed-${runId}`,
        text: 'Credenciales caducadas',
        tone: 'warning',
        stopSpinner: true,
        onDisplayed: () => {
          scheduleStatusFallbackToLastScan(`holded-credentials-failed-${runId}`);
        },
      },
      { immediate: true, replacePending: true }
    );

    clearHoldedRunRealtimeMarkers(runId);
    clearActiveHoldedScanTracking();
    scanStepBufferRef.current.delete(runId);
    activeHoldedScanRunIdRef.current = null;
    activeHoldedScanUserUidRef.current = null;
    setActiveHoldedScanRunId(null);
    setActiveHoldedScanUserUid(null);
    setHoldedLoading(false);
    setHoldedScanInProgress(false);
    setIsHoldedScanInProgress(false);
    setIsRedirectingToOAuth(false);
    setRevokedModalStage('warning');
    setReconnectFlowStage(null);
    setShowCredentialsRevokedModal(true);
  }, [clearHoldedRunRealtimeMarkers, enqueueScanStatus, scheduleStatusFallbackToLastScan, setReconnectFlowStage]);

  const stopHoldedScanForMissingCredentials = React.useCallback((runId: string) => {
    if (credentialsFailedRunRef.current === runId) {
      return;
    }

    credentialsFailedRunRef.current = runId;

    enqueueScanStatus(
      {
        key: `holded-credentials-missing-${runId}`,
        text: 'Integración requerida',
        tone: 'warning',
        stopSpinner: true,
        onDisplayed: () => {
          scheduleStatusFallbackToLastScan(`holded-credentials-missing-${runId}`);
        },
      },
      { immediate: true, replacePending: true }
    );

    clearHoldedRunRealtimeMarkers(runId);
    clearActiveHoldedScanTracking();
    scanStepBufferRef.current.delete(runId);
    activeHoldedScanRunIdRef.current = null;
    activeHoldedScanUserUidRef.current = null;
    setActiveHoldedScanRunId(null);
    setActiveHoldedScanUserUid(null);
    setHoldedLoading(false);
    setHoldedScanInProgress(false);
    setIsHoldedScanInProgress(false);
    setIsRedirectingToOAuth(false);
    setMissingCredentialsModalStage('warning');
    setMissingEmailProvider(null);
    setReconnectFlowStage(null);
    setMissingCredentialsFlowState(null, null);
    setShowCredentialsMissingModal(true);
  }, [clearHoldedRunRealtimeMarkers, enqueueScanStatus, scheduleStatusFallbackToLastScan, setMissingCredentialsFlowState, setReconnectFlowStage]);

  const stopHoldedScanForScrapperError = React.useCallback(
    (runId: string, reason: HoldedErrorReason) => {
      if (holdedErrorRunRef.current === runId) {
        return;
      }

      holdedErrorRunRef.current = runId;

      enqueueScanStatus(
        {
          key: `holded-end-error-${runId}`,
          text: 'Error en la conexión con Holded',
          tone: 'warning',
          stopSpinner: true,
          onDisplayed: () => {
            scheduleStatusFallbackToLastScan(`holded-end-error-${runId}`);
          },
        },
        { immediate: true, replacePending: true }
      );

      clearHoldedRunRealtimeMarkers(runId);
      clearActiveHoldedScanTracking();
      scanStepBufferRef.current.delete(runId);
      activeHoldedScanRunIdRef.current = null;
      activeHoldedScanUserUidRef.current = null;
      setActiveHoldedScanRunId(null);
      setActiveHoldedScanUserUid(null);
      setHoldedLoading(false);
      setHoldedScanInProgress(false);
      setIsHoldedScanInProgress(false);
      setHoldedErrorReason(reason);
      setShowHoldedErrorModal(true);
    },
    [clearHoldedRunRealtimeMarkers, enqueueScanStatus, scheduleStatusFallbackToLastScan]
  );

  const schedulePrimaryScanCompletion = React.useCallback((runId: string) => {
    enqueueScanStatus(
      {
        key: `scan-finished-${runId}`,
        text: 'Escaneo finalizado',
        tone: 'success',
        stopSpinner: true,
        showSuccessIcon: true,
        onDisplayed: () => {
          if (scanCompletionTimerRef.current !== null) {
            window.clearTimeout(scanCompletionTimerRef.current);
          }

          scanCompletionTimerRef.current = window.setTimeout(() => {
            scanCompletionTimerRef.current = null;
            finishPrimaryScan(runId);
          }, SCAN_STATUS_FINAL_HOLD_MS);
        },
      },
      { replacePending: true }
    );
  }, [enqueueScanStatus, finishPrimaryScan]);

  const scheduleHoldedScanCompletion = React.useCallback((runId: string) => {
    enqueueScanStatus(
      {
        key: `holded-scan-finished-${runId}`,
        text: 'Escaneo Holded finalizado',
        tone: 'success',
        stopSpinner: true,
        showSuccessIcon: true,
        onDisplayed: () => {
          if (scanCompletionTimerRef.current !== null) {
            window.clearTimeout(scanCompletionTimerRef.current);
          }

          scanCompletionTimerRef.current = window.setTimeout(() => {
            scanCompletionTimerRef.current = null;
            finishHoldedScan(runId);
          }, SCAN_STATUS_FINAL_HOLD_MS);
        },
      },
      { replacePending: true }
    );
  }, [enqueueScanStatus, finishHoldedScan]);

  const processPrimaryStepRow = React.useCallback((row: ScanStepRealtimeRow) => {
    const rowRunId = row.run_id != null ? String(row.run_id) : null;
    const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
    const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
    const rowProvider = typeof row.provider === 'string' ? row.provider.trim().toLowerCase() : '';
    const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
    const rowProgressTotal = toNonNegativeInteger(row.progress_total);
    const rowProgressCurrent = toNonNegativeInteger(row.progress_current);
    const rowEventKey = getScanStepEventKey(row);
    const currentRunId = activeScanRunIdRef.current;
    const currentUserUid = activeScanUserUidRef.current;

    if (!currentRunId) {
      return false;
    }

    const isSameRun = rowRunId === currentRunId;
    const isSameUser = !rowUserUid || !currentUserUid || rowUserUid === currentUserUid;

    if (!isSameRun || !isSameUser) {
      return false;
    }

    const isInvoiceProcessingStep = rowStep === 'invoice_processing';
    const isTerminalSuccessStep = isInvoiceProcessingStep && rowStatus === 'success';

    if (rowStep !== 'credentials_refresh') {
      console.info('[scan:realtime] step processed (global)', {
        rowRunId,
        rowUserUid,
        rowStep,
        rowProvider,
        rowStatus,
        rowProgressTotal,
        rowProgressCurrent,
        rowEventKey,
        currentRunId,
        currentUserUid,
        isTerminalSuccessStep,
      });
    }

    if (isCredentialsStepName(rowStep)) {
      if (isCredentialsErrorStep(rowStep, rowStatus)) {
        if (isMissingCredentialsError(rowStep, rowStatus, row.metadata)) {
          const errorCode = SCAN_ERROR_CODES.CREDENTIALS_NON_EXISTING;
          console.warn(`[scan] ERROR CODE = ${errorCode}`, { userId: user?.id });
          stopPrimaryScanForMissingCredentials(currentRunId);
          return true;
        }

        stopPrimaryScanForCredentials(currentRunId);
      }

      return true;
    }

    if (rowStep === 'scrapper' && (rowProvider === 'gmail' || rowProvider === 'outlook') && rowStatus === 'processing') {
      enqueueScanStatus(
        {
          key: `scrapper-processing-${currentRunId}`,
          text: 'Escaneando e-mail...',
          tone: 'neutral',
          minVisibleMs: SCAN_STATUS_MIN_VISIBLE_MS,
        },
        { immediate: true }
      );
    }

    if (rowStep === 'scanning_cloud' && rowStatus === 'processing') {
      enqueueScanStatus({
        key: `scanning-cloud-${currentRunId}`,
        text: 'Escaneando nube...',
        tone: 'neutral',
      });
    }

    if (isInvoiceProcessingStep) {
      const total = rowProgressTotal ?? invoiceProcessingTotalRef.current;
      if (typeof total === 'number' && total >= 0) {
        invoiceProcessingTotalRef.current = total;
      }

      const effectiveTotal = invoiceProcessingTotalRef.current;
      if (effectiveTotal === 0 && rowProgressCurrent === 0) {
        enqueueScanStatus(
          {
            key: `invoice-empty-${currentRunId}`,
            text: 'No hay archivos por procesar',
            tone: 'neutral',
            minVisibleMs: SCAN_STATUS_MIN_VISIBLE_MS,
          },
          { immediate: true }
        );
      }

      if (effectiveTotal && rowProgressCurrent === 0) {
        enqueueScanStatus({
          key: `invoice-found-${currentRunId}-${effectiveTotal}`,
          text: `Se han encontrado ${effectiveTotal} documentos`,
          tone: 'neutral',
          minVisibleMs: SCAN_STATUS_MIN_VISIBLE_MS,
        });
      }

      if (effectiveTotal && typeof rowProgressCurrent === 'number' && rowProgressCurrent > 0) {
        const currentInvoice = Math.min(rowProgressCurrent, effectiveTotal);
        enqueueScanStatus({
          key: `invoice-progress-${currentRunId}-${currentInvoice}-${effectiveTotal}`,
          text: `Escaneando factura ${currentInvoice} de ${effectiveTotal}...`,
          tone: 'neutral',
        });

        onProgressUpdateRef.current?.();
      }
    }

    if (isTerminalSuccessStep) {
      console.info('[scan:realtime] finishing run from step', currentRunId);
      schedulePrimaryScanCompletion(currentRunId);
    }

    return true;
  }, [enqueueScanStatus, schedulePrimaryScanCompletion, stopPrimaryScanForCredentials, stopPrimaryScanForMissingCredentials, user?.id]);

  const processHoldedStepRow = React.useCallback(
    (row: ScanStepRealtimeRow) => {
      const rowRunId = row.run_id != null ? String(row.run_id) : null;
      const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
      const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
      const rowProvider = typeof row.provider === 'string' ? row.provider.trim().toLowerCase() : '';
      const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
      const rowProgressTotal = toNonNegativeInteger(row.progress_total);
      const rowProgressCurrent = toNonNegativeInteger(row.progress_current);
      const rowEventKey = getScanStepEventKey(row);
      const currentRunId = activeHoldedScanRunIdRef.current;
      const currentUserUid = activeHoldedScanUserUidRef.current;

      if (!currentRunId) {
        return false;
      }

      const isSameRun = rowRunId === currentRunId;
      const isSameUser = !rowUserUid || !currentUserUid || rowUserUid === currentUserUid;
      const isHoldedScrapperStep = rowStep === 'scrapper' && rowProvider === 'holded';
      const isHoldedInvoiceProcessingStep = rowStep === 'invoice_processing' && rowProvider === 'holded';
      const isSuccess = rowStatus === 'success';
      const isError = rowStatus === 'error';
      const isProcessing = rowStatus === 'processing';
      const isCredentialsStep = isCredentialsStepName(rowStep);

      if (!isSameRun || !isSameUser) {
        return false;
      }

      if (rowStep !== 'credentials_refresh') {
        console.info('[holded:realtime] step processed (global)', {
          rowRunId,
          rowUserUid,
          rowStep,
          rowProvider,
          rowStatus,
          rowProgressTotal,
          rowProgressCurrent,
          rowEventKey,
          currentRunId,
          currentUserUid,
          isHoldedScrapperStep,
          isSuccess,
        });
      }

      if (isCredentialsStep) {
        if (isCredentialsErrorStep(rowStep, rowStatus)) {
          if (isMissingCredentialsError(rowStep, rowStatus, row.metadata)) {
            const errorCode = SCAN_ERROR_CODES.CREDENTIALS_NON_EXISTING;
            console.warn(`[scan] ERROR CODE = ${errorCode}`, { userId: user?.id });
            stopHoldedScanForMissingCredentials(currentRunId);
            return true;
          }

          stopHoldedScanForCredentials(currentRunId);
          return true;
        }

        if (isSuccess) {
          holdedCredentialsSuccessRunsRef.current.add(currentRunId);
          tryEnqueueHoldedConnectingStatus(currentRunId);
        }
        return true;
      }

      if (isHoldedScrapperStep && isProcessing) {
        holdedScrapperStartRunsRef.current.add(currentRunId);
        tryEnqueueHoldedConnectingStatus(currentRunId);
        return true;
      }

      if (isHoldedInvoiceProcessingStep) {
        tryEnqueueHoldedConnectingStatus(currentRunId);
        const total = rowProgressTotal ?? holdedProcessingTotalRef.current;
        if (typeof total === 'number' && total >= 0) {
          holdedProcessingTotalRef.current = total;
        }

        const effectiveTotal = holdedProcessingTotalRef.current;
        if (effectiveTotal && rowProgressCurrent === 0) {
          enqueueScanStatus(
            {
              key: `holded-invoice-found-${currentRunId}-${effectiveTotal}`,
              text: `Se han encontrado ${effectiveTotal} facturas nuevas en Holded`,
              tone: 'neutral',
              minVisibleMs: SCAN_STATUS_MIN_VISIBLE_MS,
            },
            { replacePending: true }
          );
        }

        if (effectiveTotal && typeof rowProgressCurrent === 'number' && rowProgressCurrent > 0) {
          const currentInvoice = Math.min(rowProgressCurrent, effectiveTotal);
          enqueueScanStatus(
            {
              key: `holded-invoice-progress-${currentRunId}-${currentInvoice}-${effectiveTotal}`,
              text: `Escaneando factura ${currentInvoice} de ${effectiveTotal}...`,
              tone: 'neutral',
            },
            { replacePending: true }
          );

          onProgressUpdateRef.current?.();
        }
      }

      if (isHoldedScrapperStep && isError) {
        const reason = getHoldedErrorReasonFromMetadata(row.metadata);
        stopHoldedScanForScrapperError(currentRunId, reason);
        return true;
      }

      if (isHoldedScrapperStep && isSuccess) {
        console.info('[holded:realtime] finishing run from step', currentRunId);
        scheduleHoldedScanCompletion(currentRunId);
      }
      return true;
    },
    [
      enqueueScanStatus,
      scheduleHoldedScanCompletion,
      stopHoldedScanForCredentials,
      stopHoldedScanForMissingCredentials,
      stopHoldedScanForScrapperError,
      tryEnqueueHoldedConnectingStatus,
      user?.id,
    ]
  );

  React.useEffect(() => {
    const runId = activeScanRunId;
    if (!runId || !isScanInProgress) {
      return;
    }

    if (lastPrimaryRunForProcessedStepsRef.current !== runId) {
      processedPrimaryStepEventKeysRef.current.clear();
      lastPrimaryRunForProcessedStepsRef.current = runId;
    }

    const rows = getBufferedScanStepsForRun(runId);
    rows.forEach((row) => {
      const key = getScanStepEventKey(row);
      if (!key || processedPrimaryStepEventKeysRef.current.has(key)) {
        return;
      }

      const wasHandled = processPrimaryStepRow(row as ScanStepRealtimeRow);
      if (wasHandled) {
        processedPrimaryStepEventKeysRef.current.add(key);
      }
    });
  }, [activeScanRunId, getBufferedScanStepsForRun, isScanInProgress, processPrimaryStepRow, scanStepsVersion]);

  React.useEffect(() => {
    if (isScanInProgress || isHoldedScanInProgress) {
      setIsScanStatusVisible(true);
    }
  }, [isHoldedScanInProgress, isScanInProgress]);

  React.useEffect(() => {
    const hasActiveFlow =
      isScanInProgress || isHoldedScanInProgress || primaryScopeLocked || holdedScopeLocked || loading || holdedLoading;

    if (hasActiveFlow) {
      if (scanStatusIdleResetTimerRef.current !== null) {
        window.clearTimeout(scanStatusIdleResetTimerRef.current);
        scanStatusIdleResetTimerRef.current = null;
      }
      return;
    }

    if (!scanStatusMessage) {
      if (scanStatusIdleResetTimerRef.current !== null) {
        window.clearTimeout(scanStatusIdleResetTimerRef.current);
        scanStatusIdleResetTimerRef.current = null;
      }
      return;
    }

    if (scanStatusQueueRef.current.length > 0 || scanStatusTimerRef.current !== null || scanStatusSwapTimerRef.current !== null) {
      return;
    }

    if (scanStatusIdleResetTimerRef.current !== null) {
      return;
    }

    const elapsed = scanStatusShownAtRef.current === 0 ? 0 : Date.now() - scanStatusShownAtRef.current;
    const waitMs =
      scanStatusShownAtRef.current === 0
        ? SCAN_STATUS_MIN_VISIBLE_MS
        : Math.max(0, scanStatusMinVisibleMsRef.current - elapsed);

    scanStatusIdleResetTimerRef.current = window.setTimeout(() => {
      scanStatusIdleResetTimerRef.current = null;

      const stillHasActiveFlow =
        isScanInProgress ||
        isHoldedScanInProgress ||
        primaryScopeLocked ||
        holdedScopeLocked ||
        loading ||
        holdedLoading;
      if (stillHasActiveFlow) {
        return;
      }

      if (scanStatusQueueRef.current.length > 0 || scanStatusTimerRef.current !== null || scanStatusSwapTimerRef.current !== null) {
        return;
      }

      resetScanStatusUI();
    }, waitMs);

    return () => {
      if (scanStatusIdleResetTimerRef.current !== null) {
        window.clearTimeout(scanStatusIdleResetTimerRef.current);
        scanStatusIdleResetTimerRef.current = null;
      }
    };
  }, [
    holdedLoading,
    holdedScopeLocked,
    isHoldedScanInProgress,
    isScanInProgress,
    loading,
    primaryScopeLocked,
    resetScanStatusUI,
    scanStatusMessage,
  ]);

  React.useEffect(() => {
    const runId = activeHoldedScanRunId;
    if (!runId || !isHoldedScanInProgress) {
      return;
    }

    if (lastHoldedRunForProcessedStepsRef.current !== runId) {
      processedHoldedStepEventKeysRef.current.clear();
      lastHoldedRunForProcessedStepsRef.current = runId;
    }

    const rows = getBufferedScanStepsForRun(runId);
    rows.forEach((row) => {
      const key = getScanStepEventKey(row);
      if (!key || processedHoldedStepEventKeysRef.current.has(key)) {
        return;
      }

      const wasHandled = processHoldedStepRow(row as ScanStepRealtimeRow);
      if (wasHandled) {
        processedHoldedStepEventKeysRef.current.add(key);
      }
    });
  }, [
    activeHoldedScanRunId,
    getBufferedScanStepsForRun,
    isHoldedScanInProgress,
    processHoldedStepRow,
    scanStepsVersion,
  ]);

  React.useEffect(() => {
    const runId = activeScanRunId;
    if (!user?.id || !runId || !isScanInProgress) {
      return;
    }

    const bufferedLatest = getLatestBufferedNonCredentialStepForRun(runId);
    if (bufferedLatest) {
      const key = getScanStepEventKey(bufferedLatest);
      if (key && !processedPrimaryStepEventKeysRef.current.has(key)) {
        const wasHandled = processPrimaryStepRow(bufferedLatest as ScanStepRealtimeRow);
        if (wasHandled) {
          processedPrimaryStepEventKeysRef.current.add(key);
        }
      }
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('scan_steps')
        .select('id, run_id, user_uid, step, provider, status, metadata, progress_total, progress_current, last_updated_at')
        .eq('run_id', runId)
        .neq('step', 'credentials_refresh')
        .order('last_updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || error || !data) {
        return;
      }

      const key = getScanStepEventKey(data as ScanStepRealtimeRow);
      if (!key || processedPrimaryStepEventKeysRef.current.has(key)) {
        return;
      }

      const wasHandled = processPrimaryStepRow(data as ScanStepRealtimeRow);
      if (wasHandled) {
        processedPrimaryStepEventKeysRef.current.add(key);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeScanRunId, getLatestBufferedNonCredentialStepForRun, isScanInProgress, processPrimaryStepRow, user?.id]);

  React.useEffect(() => {
    const runId = activeHoldedScanRunId;
    if (!user?.id || !runId || !isHoldedScanInProgress) {
      return;
    }

    const bufferedLatest = getLatestBufferedNonCredentialStepForRun(runId);
    if (bufferedLatest) {
      const key = getScanStepEventKey(bufferedLatest);
      if (key && !processedHoldedStepEventKeysRef.current.has(key)) {
        const wasHandled = processHoldedStepRow(bufferedLatest as ScanStepRealtimeRow);
        if (wasHandled) {
          processedHoldedStepEventKeysRef.current.add(key);
        }
      }
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('scan_steps')
        .select('id, run_id, user_uid, step, provider, status, metadata, progress_total, progress_current, last_updated_at')
        .eq('run_id', runId)
        .neq('step', 'credentials_refresh')
        .order('last_updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || error || !data) {
        return;
      }

      const key = getScanStepEventKey(data as ScanStepRealtimeRow);
      if (!key || processedHoldedStepEventKeysRef.current.has(key)) {
        return;
      }

      const wasHandled = processHoldedStepRow(data as ScanStepRealtimeRow);
      if (wasHandled) {
        processedHoldedStepEventKeysRef.current.add(key);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeHoldedScanRunId,
    getLatestBufferedNonCredentialStepForRun,
    isHoldedScanInProgress,
    processHoldedStepRow,
    user?.id,
  ]);

  const handleCancelScanLock = React.useCallback(() => {
    const runId = activeScanRunIdRef.current;
    if (runId) {
      scanStepBufferRef.current.delete(runId);
    }
    clearActivePrimaryScanTracking();
    activeScanRunIdRef.current = null;
    activeScanUserUidRef.current = null;
    setActiveScanRunId(null);
    setActiveScanUserUid(null);
    setActiveScanType(null);
    setLoading(false);
    setScanInProgress(false);
    resetScanStatusUI();
  }, [resetScanStatusUI]);

  const handleCancelHoldedScanLock = React.useCallback(() => {
    const runId = activeHoldedScanRunIdRef.current;
    if (runId) {
      scanStepBufferRef.current.delete(runId);
    }
    clearHoldedRunRealtimeMarkers(runId);
    clearActiveHoldedScanTracking();
    activeHoldedScanRunIdRef.current = null;
    activeHoldedScanUserUidRef.current = null;
    setActiveHoldedScanRunId(null);
    setActiveHoldedScanUserUid(null);
    setHoldedLoading(false);
    setIsHoldedScanInProgress(false);
    setHoldedScanInProgress(false);
    resetScanStatusUI();
  }, [clearHoldedRunRealtimeMarkers, resetScanStatusUI]);

  const handleScan = async () => {
    if (!user?.id || loading || isScanInProgress || holdedLoading || isHoldedScanInProgress || isAnyScopeLocked) {
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
    completedRunToastRef.current = null;
    credentialsFailedRunRef.current = null;
    invoiceProcessingTotalRef.current = null;
    enqueueScanStatus(
      {
        key: 'scan-starting',
        text: 'Iniciando escaneo...',
        tone: 'neutral',
      },
      { immediate: true, replacePending: true }
    );
    showSyncedToast('primary-started');
    broadcastToast('primary-started');

    try {
      const response = await triggerN8nAction(emailType);
      const payload = (await response.json().catch(() => null)) as ScanStartWebhookResponse | null;

      const runId = typeof payload?.run_id === 'string' && payload.run_id.trim().length > 0 ? payload.run_id.trim() : null;
      const userUid =
        typeof payload?.user_uid === 'string' && payload.user_uid.trim().length > 0 ? payload.user_uid.trim() : user?.id ?? null;
      const scanType = normalizeScanType(payload?.scan_type) ?? normalizeScanType(emailType) ?? 'gmail';

      if (!runId || !userUid) {
        throw new Error('El webhook no devolvió run_id/user_uid válidos.');
      }

      console.info('[scan:start] webhook ack', { runId, userUid, scanType, emailType });

      setActivePrimaryScanTracking(runId, userUid, scanType);
      activeScanRunIdRef.current = runId;
      activeScanUserUidRef.current = userUid;
      activeScanTypeRef.current = scanType;
      setActiveScanRunId(runId);
      setActiveScanUserUid(userUid);
      setActiveScanType(scanType);

      const bufferedRows = scanStepBufferRef.current.get(runId) ?? [];
      const hasBufferedCredentialsFailure = bufferedRows.some((row) => {
        const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
        const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
        const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
        const isSameUser = !rowUserUid || rowUserUid === userUid;
        return isSameUser && isCredentialsErrorStep(rowStep, rowStatus);
      });
      const hasBufferedMissingCredentials = bufferedRows.some((row) => {
        const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
        const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
        const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
        const isSameUser = !rowUserUid || rowUserUid === userUid;
        return isSameUser && isMissingCredentialsError(rowStep, rowStatus, row.metadata);
      });
      const hasBufferedTerminalSuccess = bufferedRows.some((row) => {
        const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
        const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
        const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
        const isSameUser = !rowUserUid || rowUserUid === userUid;
        return isSameUser && rowStep === 'invoice_processing' && rowStatus === 'success';
      });

      if (hasBufferedCredentialsFailure) {
        if (hasBufferedMissingCredentials) {
          const errorCode = SCAN_ERROR_CODES.CREDENTIALS_NON_EXISTING;
          console.warn(`[scan] ERROR CODE = ${errorCode}`, { userId: user?.id });
          stopPrimaryScanForMissingCredentials(runId);
          return;
        }
        stopPrimaryScanForCredentials(runId);
        return;
      }

      if (hasBufferedTerminalSuccess) {
        console.info('[scan:realtime] finishing run from buffered events', runId);
        schedulePrimaryScanCompletion(runId);
        return;
      }

      const hasRevokedCredentials = hasRevokedCredentialsStatus(payload as unknown);

      if (!hasRevokedCredentials) {
        setLoading(false);
      }

      if (hasRevokedCredentials) {
        const errorCode = SCAN_ERROR_CODES.GOOGLE_CREDENTIALS_REVOKED;
        console.warn(`[scan] ERROR CODE = ${errorCode}`, { userId: user?.id });
        stopPrimaryScanForCredentials(runId);
      }
    } catch (error) {
      toast({
        title: 'No se pudo lanzar el escaneo',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
        className: SCAN_TOAST_BASE_CLASS,
      });
      clearActivePrimaryScanTracking();
      const runId = activeScanRunIdRef.current;
      if (runId) {
        scanStepBufferRef.current.delete(runId);
      }
      activeScanRunIdRef.current = null;
      activeScanUserUidRef.current = null;
      activeScanTypeRef.current = null;
      setActiveScanRunId(null);
      setActiveScanUserUid(null);
      setActiveScanType(null);
      setScanInProgress(false);
      setLoading(false);
      resetScanStatusUI();
    } finally {
      setLoading(false);
    }
  };

  const handleHoldedScan = async () => {
    if (!user?.id || holdedLoading || isHoldedScanInProgress || loading || isScanInProgress || isAnyScopeLocked) {
      return;
    }

    setHoldedLoading(true);
    setHoldedScanInProgress(true);
    setIsHoldedScanInProgress(true);
    completedHoldedRunToastRef.current = null;
    holdedErrorRunRef.current = null;
    holdedProcessingTotalRef.current = null;
    enqueueScanStatus(
      {
        key: 'holded-scan-starting',
        text: 'Iniciando escaneo Holded...',
        tone: 'neutral',
      },
      { immediate: true, replacePending: true }
    );
    showSyncedToast('holded-started');
    broadcastToast('holded-started');

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

      const payload = (await response.json().catch(() => null)) as ScanStartWebhookResponse | null;
      const runId = typeof payload?.run_id === 'string' && payload.run_id.trim().length > 0 ? payload.run_id.trim() : null;
      const userUid =
        typeof payload?.user_uid === 'string' && payload.user_uid.trim().length > 0 ? payload.user_uid.trim() : user?.id ?? null;

      if (!runId || !userUid) {
        throw new Error('El webhook de Holded no devolvió run_id/user_uid válidos.');
      }

      console.info('[holded:start] webhook ack', {
        runId,
        userUid,
        scanType: payload?.scan_type,
      });

      setActiveHoldedScanTracking(runId, userUid);
      activeHoldedScanRunIdRef.current = runId;
      activeHoldedScanUserUidRef.current = userUid;
      setActiveHoldedScanRunId(runId);
      setActiveHoldedScanUserUid(userUid);

      const bufferedRows = scanStepBufferRef.current.get(runId) ?? [];
      bufferedRows.forEach((row) => {
        const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
        const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
        const rowProvider = typeof row.provider === 'string' ? row.provider.trim().toLowerCase() : '';
        const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
        const isSameUser = !rowUserUid || rowUserUid === userUid;

        if (!isSameUser) {
          return;
        }

        if (isCredentialsStepName(rowStep) && rowStatus === 'success') {
          holdedCredentialsSuccessRunsRef.current.add(runId);
        }

        if (rowStep === 'scrapper' && rowProvider === 'holded' && rowStatus === 'processing') {
          holdedScrapperStartRunsRef.current.add(runId);
        }
      });

      tryEnqueueHoldedConnectingStatus(runId);

      const hasBufferedCredentialsFailure = bufferedRows.some((row) => {
        const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
        const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
        const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
        const isSameUser = !rowUserUid || rowUserUid === userUid;
        return isSameUser && isCredentialsErrorStep(rowStep, rowStatus);
      });
      const hasBufferedMissingCredentials = bufferedRows.some((row) => {
        const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
        const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
        const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
        const isSameUser = !rowUserUid || rowUserUid === userUid;
        return isSameUser && isMissingCredentialsError(rowStep, rowStatus, row.metadata);
      });
      const hasBufferedFinish = bufferedRows.some((row) => {
        const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
        const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
        const rowProvider = typeof row.provider === 'string' ? row.provider.trim().toLowerCase() : '';
        const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
        const isSameUser = !rowUserUid || rowUserUid === userUid;
        return isSameUser && rowStep === 'scrapper' && rowProvider === 'holded' && rowStatus === 'success';
      });
      const bufferedEndErrorRow = bufferedRows.find((row) => {
        const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
        const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
        const rowProvider = typeof row.provider === 'string' ? row.provider.trim().toLowerCase() : '';
        const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
        const isSameUser = !rowUserUid || rowUserUid === userUid;
        return isSameUser && rowStep === 'scrapper' && rowProvider === 'holded' && rowStatus === 'error';
      });

      if (hasBufferedCredentialsFailure) {
        if (hasBufferedMissingCredentials) {
          const errorCode = SCAN_ERROR_CODES.CREDENTIALS_NON_EXISTING;
          console.warn(`[scan] ERROR CODE = ${errorCode}`, { userId: user?.id });
          stopHoldedScanForMissingCredentials(runId);
          return;
        }

        stopHoldedScanForCredentials(runId);
        return;
      }

      if (hasBufferedFinish) {
        console.info('[holded:realtime] finishing run from buffered events', runId);
        scheduleHoldedScanCompletion(runId);
      }

      if (bufferedEndErrorRow) {
        const reason = getHoldedErrorReasonFromMetadata(bufferedEndErrorRow.metadata);
        stopHoldedScanForScrapperError(runId, reason);
        return;
      }
    } catch (error) {
      toast({
        title: 'No se pudo lanzar Escanear Holded',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
        className: SCAN_TOAST_BASE_CLASS,
      });

      clearActiveHoldedScanTracking();
      const runId = activeHoldedScanRunIdRef.current;
      if (runId) {
        scanStepBufferRef.current.delete(runId);
      }
      clearHoldedRunRealtimeMarkers(runId);
      activeHoldedScanRunIdRef.current = null;
      activeHoldedScanUserUidRef.current = null;
      setActiveHoldedScanRunId(null);
      setActiveHoldedScanUserUid(null);
      setIsHoldedScanInProgress(false);
      setHoldedScanInProgress(false);
      resetScanStatusUI();
    } finally {
      setHoldedLoading(false);
    }
  };

  const statusToneClass =
    scanStatusMessage?.tone === 'success'
      ? 'text-emerald-700'
      : scanStatusMessage?.tone === 'warning'
        ? 'text-amber-700'
        : 'text-gray-500';
  const shouldSpinStatusIcon =
    (loading || holdedLoading || isBootstrapping || isScanInProgress || isHoldedScanInProgress) && !stopStatusSpinner;
  const statusText =
    scanStatusMessage?.text ??
    (isScanInProgress || isHoldedScanInProgress
      ? 'Escaneo en curso...'
      : `Último escaneo exitoso hace ${formatElapsedSince(lastScanAt)}`);
  const isPrimaryActionActive = loading || (isScanInProgress && (activeScanType != null || primaryRunningScanType != null));
  const isHoldedActionActive = holdedLoading || isHoldedScanInProgress;
  const isPrimaryButtonDisabled =
    isPrimaryActionActive || isHoldedActionActive || isAnyScopeLocked || isBootstrapping || !user?.id;
  const isHoldedButtonDisabled =
    isHoldedActionActive || isPrimaryActionActive || isAnyScopeLocked || isBootstrapping || !user?.id;
  const showScheduledLockHint = isAnyScopeLocked && !isScanInProgress && !isHoldedScanInProgress && !loading && !holdedLoading;

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw
            className={`h-4 w-4 transition-colors ${shouldSpinStatusIcon ? 'animate-spin text-slate-900' : 'text-gray-500'}`}
          />
          <div aria-live="polite" className="flex min-h-[20px] items-center gap-1.5 overflow-hidden">
            <span
              className={`block transform-gpu transition-all duration-300 ${isScanStatusVisible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'} ${statusToneClass}`}
            >
              {statusText}
            </span>
            {scanStatusMessage?.showSuccessIcon ? (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] bg-emerald-500 text-white">
                <Check className="h-3 w-3" />
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showHoldedScan && isHoldedConnected && isHoldedActionActive ? (
            <Button
              type="button"
              onClick={handleCancelHoldedScanLock}
              variant="outline"
              className="border-[#ffafb7] text-[#d92d42] hover:bg-[#fff1f3]"
            >
              Cancelar
            </Button>
          ) : null}

          {showHoldedScan && isHoldedConnected ? (
            <Button
              type="button"
              onClick={handleHoldedScan}
              disabled={isHoldedButtonDisabled}
              className="bg-[#ff4254] text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#ff3247] hover:shadow-md active:translate-y-0 focus-visible:ring-2 focus-visible:ring-[#ff9ca6]"
            >
              {isHoldedActionActive ? (
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

          {showScheduledLockHint ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
              <span>Hay un escaneo en curso</span>
            </div>
          ) : null}

          {isPrimaryActionActive ? (
            <Button
              type="button"
              onClick={handleCancelScanLock}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={handleScan}
            disabled={isPrimaryButtonDisabled}
            className="bg-slate-950 text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-md active:translate-y-0 focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {isPrimaryActionActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
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

      {showCredentialsMissingModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-[470px] overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_30px_90px_rgba(15,23,42,0.28)] sm:px-6">
            <button
              type="button"
              aria-label="Cerrar"
              onClick={closeMissingCredentialsModal}
              className="absolute right-4 top-4 z-30 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative w-full overflow-hidden">
              <div
                className="flex w-full transform-gpu transition-transform duration-500 ease-in-out"
                style={{ transform: `translate3d(-${MISSING_CREDENTIALS_MODAL_STAGE_ORDER.indexOf(missingCredentialsModalStage) * 100}%, 0, 0)` }}
              >
                <div className="w-full min-w-full flex-none px-1 text-center">
                  <h3 className="pr-7 text-[28px] font-semibold tracking-[-0.02em] leading-[1.08] text-[#0a1f44] sm:text-[30px]">
                    Integración necesaria para escanear
                  </h3>
                  <p className="mt-2 text-base leading-7 text-slate-600">
                    No has integrado aún un proveedor de correo y nube. Para continuar, conecta primero el correo y
                    después su almacenamiento asociado.
                  </p>
                  <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button
                      type="button"
                      onClick={closeMissingCredentialsModal}
                      variant="outline"
                      className="h-11 w-full max-w-[180px] rounded-xl border-slate-300 text-base text-slate-700 hover:bg-slate-100"
                    >
                      Más tarde
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setMissingCredentialsFlowState('email', missingEmailProvider);
                        setMissingCredentialsModalStage('email');
                      }}
                      className="h-11 w-full max-w-[180px] rounded-xl bg-gradient-to-r from-[#1d6bff] to-[#00a3ff] text-base font-semibold text-white shadow-[0_14px_30px_rgba(21,95,245,0.35)] transition-transform duration-200 hover:-translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_18px_34px_rgba(21,95,245,0.38)] active:translate-y-0"
                    >
                      Integrar ahora
                    </Button>
                  </div>
                </div>

                <div className="w-full min-w-full flex-none px-1 text-center">
                  <h3 className="pr-7 text-[28px] font-semibold tracking-[-0.02em] leading-[1.08] text-[#0a1f44] sm:text-[30px]">
                    Integra tu correo
                  </h3>
                  <div className="mt-4 space-y-3">
                    <SelectableIntegrationCard
                      logoSrc="/brand/onboarding/gmail_logo.png"
                      name="Gmail"
                      selected={missingEmailProvider === 'gmail'}
                      onClick={() => setMissingEmailProvider('gmail')}
                    />
                    <SelectableIntegrationCard
                      logoSrc="/brand/onboarding/outlook_logo.png"
                      name="Outlook"
                      selected={missingEmailProvider === 'outlook'}
                      onClick={() => setMissingEmailProvider('outlook')}
                    />
                  </div>
                  <div className="mt-7 flex justify-center">
                    <Button
                      type="button"
                      onClick={handleMissingCredentialsEmailConnect}
                      disabled={isRedirectingToOAuth || !missingEmailProvider}
                      className="h-11 w-full max-w-[240px] rounded-xl bg-gradient-to-r from-[#1d6bff] to-[#00a3ff] text-base font-semibold text-white shadow-[0_14px_30px_rgba(21,95,245,0.35)] transition-transform duration-200 hover:-translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_18px_34px_rgba(21,95,245,0.38)] active:translate-y-0"
                    >
                      <Plug className="mr-1 h-4 w-4" />
                      {isRedirectingToOAuth ? 'Conectando…' : 'Conectar'}
                    </Button>
                  </div>
                </div>

                <div className="w-full min-w-full flex-none px-1 text-center">
                  <h3 className="pr-7 text-[28px] font-semibold tracking-[-0.02em] leading-[1.08] text-[#0a1f44] sm:text-[30px]">
                    {missingEmailProvider === 'outlook' ? 'Conecta OneDrive' : 'Conecta Google Drive'}
                  </h3>
                  <div className="mt-4">
                    <ReconnectIntegrationCard
                      logoSrc={missingEmailProvider === 'outlook' ? '/brand/onboarding/onedrive_logo.png' : '/brand/onboarding/drive_logo.png'}
                      name={missingEmailProvider === 'outlook' ? 'OneDrive' : 'Google Drive'}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {missingEmailProvider === 'outlook'
                      ? 'Tras Outlook, debes integrar OneDrive para completar el proceso.'
                      : 'Tras Gmail, debes integrar Google Drive para completar el proceso.'}
                  </p>
                  <div className="mt-7 flex justify-center">
                    <Button
                      type="button"
                      onClick={handleMissingCredentialsStorageConnect}
                      disabled={isRedirectingToOAuth || !missingEmailProvider}
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
                    ¡Integración completada!
                  </h3>
                  <p className="mt-2 text-base leading-7 text-slate-600">
                    {missingEmailProvider === 'outlook'
                      ? 'Outlook y OneDrive ya están integrados. Por favor, ejecuta el escaneo de nuevo.'
                      : 'Gmail y Google Drive ya están integrados. Por favor, ejecuta el escaneo de nuevo.'}
                  </p>
                  <div className="mt-6 flex justify-center">
                    <Button
                      type="button"
                      onClick={closeMissingCredentialsModal}
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

      {showHoldedErrorModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-[500px] overflow-hidden rounded-2xl border border-[#ffd3d8] bg-white px-5 py-6 shadow-[0_30px_90px_rgba(15,23,42,0.28)] sm:px-6">
            <button
              type="button"
              aria-label="Cerrar"
              onClick={closeHoldedErrorModal}
              className="absolute right-4 top-4 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>

            <span className="absolute left-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fff1f3] text-[#d92d42] sm:left-6 sm:top-6">
                <AlertTriangle className="h-5 w-5" />
            </span>

            <div className="flex flex-col items-center text-center">
              <Image
                src="/brand/tab_ingresos/holded_logo.png"
                alt="Holded"
                width={38}
                height={38}
                className="h-[38px] w-[38px] rounded-md"
              />

              <h3 className="mt-4 text-[28px] font-semibold tracking-[-0.02em] leading-[1.08] text-[#0a1f44] sm:text-[30px]">
                {holdedErrorReason === 'holded_unpaid' ? 'Suscripción de Holded impagada' : 'No se pudo completar el escaneo de Holded'}
              </h3>

              <p className="mt-2 max-w-[420px] text-base leading-7 text-slate-600">
                {holdedErrorReason === 'holded_unpaid'
                  ? 'Tu suscripción de Holded está impagada y no permite recoger facturas. Regularízala en Holded y vuelve a intentarlo.'
                  : (
                    <>
                      Ha ocurrido un error con la conexión a Holded.
                      <br />
                      Por favor, ponte en contacto con soporte de Clerio en hola@clerio.es.
                    </>
                  )}
              </p>

              <div className="mt-6 flex justify-center">
                <Button
                  type="button"
                  onClick={closeHoldedErrorModal}
                  className="h-11 min-w-[160px] rounded-xl bg-[#ff4254] text-base font-semibold text-white shadow-[0_14px_30px_rgba(217,45,66,0.25)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#ff3247] hover:shadow-[0_18px_34px_rgba(217,45,66,0.32)] active:translate-y-0"
                >
                  Entendido
                </Button>
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

function SelectableIntegrationCard({
  logoSrc,
  name,
  selected,
  onClick,
}: {
  logoSrc: string;
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mx-auto flex w-full max-w-[340px] items-center justify-center gap-3 rounded-2xl border px-5 py-3 shadow-[0_10px_24px_rgba(12,32,72,0.05)] transition ${
        selected ? 'border-[#1d6bff] bg-[#eef5ff]' : 'border-[#dde4f3] bg-white hover:border-[#b7cdf8]'
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
        <Image src={logoSrc} alt={name} width={36} height={36} className="h-9 w-9 rounded-lg" />
      </span>
      <p className="text-base font-semibold text-[#0a1f44]">{name}</p>
      {selected ? <Check className="h-4 w-4 text-[#1d6bff]" /> : null}
    </button>
  );
}
