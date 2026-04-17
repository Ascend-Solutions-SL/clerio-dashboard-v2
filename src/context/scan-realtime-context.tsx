"use client";

import React from 'react';

import { useDashboardSession } from '@/context/dashboard-session-context';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

export type ScanStepRealtimeEventRow = {
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

type ScanRunsRealtimeRow = {
  id?: string | number | null;
  user_uid?: string | null;
  scan_scope?: string | null;
  status?: string | null;
  scan_type?: string | null;
};

type ScanRealtimeContextValue = {
  locksHydrated: boolean;
  primaryScopeLocked: boolean;
  holdedScopeLocked: boolean;
  primaryRunningRunId: string | null;
  primaryRunningScanType: 'gmail' | 'outlook' | null;
  holdedRunningRunId: string | null;
  scanStepsVersion: number;
  getBufferedScanStepsForRun: (runId: string) => ScanStepRealtimeEventRow[];
  getLatestBufferedNonCredentialStepForRun: (runId: string) => ScanStepRealtimeEventRow | null;
};

const ScanRealtimeContext = React.createContext<ScanRealtimeContextValue | undefined>(undefined);

const SCAN_STEPS_BUFFER_LIMIT = 60;
const SCAN_IN_PROGRESS_EVENT = 'invoice-scan-in-progress-changed';
const SCAN_IN_PROGRESS_STORAGE_KEY = 'invoice-scan-in-progress';
const SCAN_ACTIVE_RUN_ID_STORAGE_KEY = 'invoice-scan-active-run-id';
const SCAN_ACTIVE_USER_UID_STORAGE_KEY = 'invoice-scan-active-user-uid';
const SCAN_ACTIVE_SCAN_TYPE_STORAGE_KEY = 'invoice-scan-active-scan-type';
const HOLDED_SCAN_IN_PROGRESS_EVENT = 'holded-scan-in-progress-changed';
const HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY = 'holded-scan-in-progress';
const HOLDED_SCAN_ACTIVE_RUN_ID_STORAGE_KEY = 'holded-scan-active-run-id';
const HOLDED_SCAN_ACTIVE_USER_UID_STORAGE_KEY = 'holded-scan-active-user-uid';
const SCAN_TOAST_DURATION_MS = 3000;
const SCAN_TOAST_BASE_CLASS =
  'w-[420px] max-w-[calc(100vw-2rem)] min-h-[104px] data-[state=closed]:slide-out-to-right-0 data-[state=closed]:fade-out-100';
const SCAN_TOAST_SUCCESS_CLASS = `${SCAN_TOAST_BASE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-950`;

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

const clearPrimaryRuntimeTracking = () => {
  if (typeof window === 'undefined') {
    return;
  }

  writeScanStorage(SCAN_IN_PROGRESS_STORAGE_KEY, null);
  writeScanStorage(SCAN_ACTIVE_RUN_ID_STORAGE_KEY, null);
  writeScanStorage(SCAN_ACTIVE_USER_UID_STORAGE_KEY, null);
  writeScanStorage(SCAN_ACTIVE_SCAN_TYPE_STORAGE_KEY, null);
  window.dispatchEvent(new CustomEvent(SCAN_IN_PROGRESS_EVENT, { detail: { inProgress: false } }));
};

const clearHoldedRuntimeTracking = () => {
  if (typeof window === 'undefined') {
    return;
  }

  writeScanStorage(HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY, null);
  writeScanStorage(HOLDED_SCAN_ACTIVE_RUN_ID_STORAGE_KEY, null);
  writeScanStorage(HOLDED_SCAN_ACTIVE_USER_UID_STORAGE_KEY, null);
  window.dispatchEvent(new CustomEvent(HOLDED_SCAN_IN_PROGRESS_EVENT, { detail: { inProgress: false } }));
};

const normalizeScanScope = (value: unknown): 'primary' | 'holded' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'primary' || normalized === 'holded') {
    return normalized;
  }

  return null;
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

export function ScanRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useDashboardSession();
  const [locksHydrated, setLocksHydrated] = React.useState(false);
  const [primaryScopeLocked, setPrimaryScopeLocked] = React.useState(false);
  const [holdedScopeLocked, setHoldedScopeLocked] = React.useState(false);
  const [primaryRunningRunId, setPrimaryRunningRunId] = React.useState<string | null>(null);
  const [primaryRunningScanType, setPrimaryRunningScanType] = React.useState<'gmail' | 'outlook' | null>(null);
  const [holdedRunningRunId, setHoldedRunningRunId] = React.useState<string | null>(null);
  const [scanStepsVersion, setScanStepsVersion] = React.useState(0);
  const scanStepsBufferRef = React.useRef<Map<string, ScanStepRealtimeEventRow[]>>(new Map());
  const completedPrimaryToastRunIdsRef = React.useRef<Set<string>>(new Set());
  const completedHoldedToastRunIdsRef = React.useRef<Set<string>>(new Set());

  const getBufferedScanStepsForRun = React.useCallback((runId: string) => {
    if (!runId) {
      return [];
    }

    return scanStepsBufferRef.current.get(runId) ?? [];
  }, []);

  const getLatestBufferedNonCredentialStepForRun = React.useCallback((runId: string) => {
    if (!runId) {
      return null;
    }

    const rows = scanStepsBufferRef.current.get(runId) ?? [];
    const filtered = rows.filter((row) => {
      const step = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
      return step !== 'credentials_refresh';
    });

    if (filtered.length === 0) {
      return null;
    }

    return filtered[filtered.length - 1] ?? null;
  }, []);

  React.useEffect(() => {
    setLocksHydrated(false);

    if (!user?.id) {
      setPrimaryScopeLocked(false);
      setHoldedScopeLocked(false);
      setPrimaryRunningRunId(null);
      setPrimaryRunningScanType(null);
      setHoldedRunningRunId(null);
      scanStepsBufferRef.current.clear();
      completedPrimaryToastRunIdsRef.current.clear();
      completedHoldedToastRunIdsRef.current.clear();
      setScanStepsVersion((prev) => prev + 1);
      setLocksHydrated(true);
      return;
    }

    let isCleaningUp = false;

    const hydrateRunningLocks = async () => {
      const { data, error } = await supabase
        .from('scan_runs')
        .select('id, user_uid, scan_scope, status, scan_type')
        .eq('user_uid', user.id)
        .eq('status', 'running');

      if (error) {
        console.error('[scan:realtime-context] failed to hydrate running locks', error);
        setLocksHydrated(true);
        return;
      }

      const rows = (data ?? []) as ScanRunsRealtimeRow[];
      const primaryRow = rows.find((row) => normalizeScanScope(row.scan_scope) === 'primary') ?? null;
      const holdedRow = rows.find((row) => normalizeScanScope(row.scan_scope) === 'holded') ?? null;

      setPrimaryScopeLocked(Boolean(primaryRow));
      setHoldedScopeLocked(Boolean(holdedRow));
      setPrimaryRunningRunId(primaryRow?.id != null ? String(primaryRow.id) : null);
      setPrimaryRunningScanType(normalizeScanType(primaryRow?.scan_type));
      setHoldedRunningRunId(holdedRow?.id != null ? String(holdedRow.id) : null);
      setLocksHydrated(true);
    };

    void hydrateRunningLocks();

    const hasRealtimeErrorDetails = (err?: Error) =>
      err instanceof Error && typeof err.message === 'string' && err.message.trim().length > 0;

    const scanRunsChannel = supabase
      .channel(`scan_runs_lock_global_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_runs',
          filter: `user_uid=eq.${user.id}`,
        },
        (payload: { new?: unknown; old?: unknown }) => {
          const nextRow = (payload.new as ScanRunsRealtimeRow | null) ?? null;
          const prevRow = (payload.old as ScanRunsRealtimeRow | null) ?? null;
          const scope = normalizeScanScope(nextRow?.scan_scope ?? prevRow?.scan_scope ?? null);
          if (!scope) {
            return;
          }

          const isRunning = typeof nextRow?.status === 'string' && nextRow.status.trim().toLowerCase() === 'running';
          const nextStatus = typeof nextRow?.status === 'string' ? nextRow.status.trim().toLowerCase() : '';
          const prevStatus = typeof prevRow?.status === 'string' ? prevRow.status.trim().toLowerCase() : '';
          const transitionedFromRunning = prevStatus === 'running' && nextStatus !== 'running';
          const runId = nextRow?.id != null ? String(nextRow.id) : prevRow?.id != null ? String(prevRow.id) : null;
          const shouldClearRuntime = transitionedFromRunning || (!!runId && nextStatus.length > 0 && nextStatus !== 'running');

          if (scope === 'primary') {
            setPrimaryScopeLocked(isRunning);
            setPrimaryRunningRunId(isRunning && nextRow?.id != null ? String(nextRow.id) : null);
            setPrimaryRunningScanType(isRunning ? normalizeScanType(nextRow?.scan_type) : null);
            if (shouldClearRuntime) {
              clearPrimaryRuntimeTracking();
            }
            if (runId && nextStatus === 'success' && !completedPrimaryToastRunIdsRef.current.has(runId)) {
              completedPrimaryToastRunIdsRef.current.add(runId);
              toast({
                title: 'Escaneo finalizado',
                description: 'Se ha finalizado el escaneo de facturas.',
                duration: SCAN_TOAST_DURATION_MS,
                className: SCAN_TOAST_SUCCESS_CLASS,
              });
            }
            return;
          }

          setHoldedScopeLocked(isRunning);
          setHoldedRunningRunId(isRunning && nextRow?.id != null ? String(nextRow.id) : null);
          if (shouldClearRuntime) {
            clearHoldedRuntimeTracking();
          }
          if (runId && nextStatus === 'success' && !completedHoldedToastRunIdsRef.current.has(runId)) {
            completedHoldedToastRunIdsRef.current.add(runId);
            toast({
              title: 'Escaneo finalizado',
              description: 'Se ha finalizado el escaneo de facturas de Holded.',
              duration: SCAN_TOAST_DURATION_MS,
              className: SCAN_TOAST_SUCCESS_CLASS,
            });
          }
        }
      )
      .subscribe((status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR', err?: Error) => {
        if (status === 'SUBSCRIBED') {
          return;
        }

        if (status === 'CLOSED' && isCleaningUp) {
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (hasRealtimeErrorDetails(err)) {
            console.error('[scan:realtime-context] scan_runs channel status', { status, err, userUid: user.id });
            return;
          }

          if (process.env.NODE_ENV !== 'production') {
            console.warn('[scan:realtime-context] scan_runs transient channel status', { status, userUid: user.id });
          }
        }
      });

    const scanStepsChannel = supabase
      .channel(`scan_steps_global_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_steps',
          filter: `user_uid=eq.${user.id}`,
        },
        (payload: { new?: unknown }) => {
          const row = (payload.new as ScanStepRealtimeEventRow | null) ?? null;
          if (!row || row.run_id == null) {
            return;
          }

          const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
          if (!rowUserUid || rowUserUid !== user.id) {
            return;
          }
          const runId = String(row.run_id);

          const bufferedRows = scanStepsBufferRef.current.get(runId) ?? [];
          const nextRows = [...bufferedRows, row].slice(-SCAN_STEPS_BUFFER_LIMIT);
          scanStepsBufferRef.current.set(runId, nextRows);
          setScanStepsVersion((prev) => prev + 1);
        }
      )
      .subscribe((status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR', err?: Error) => {
        if (status === 'SUBSCRIBED') {
          return;
        }

        if (status === 'CLOSED' && isCleaningUp) {
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (hasRealtimeErrorDetails(err)) {
            console.error('[scan:realtime-context] scan_steps channel status', { status, err, userUid: user.id });
            return;
          }

          if (process.env.NODE_ENV !== 'production') {
            console.warn('[scan:realtime-context] scan_steps transient channel status', { status, userUid: user.id });
          }
        }
      });

    return () => {
      isCleaningUp = true;
      void supabase.removeChannel(scanRunsChannel);
      void supabase.removeChannel(scanStepsChannel);
    };
  }, [user?.id]);

  const value = React.useMemo<ScanRealtimeContextValue>(
    () => ({
      locksHydrated,
      primaryScopeLocked,
      holdedScopeLocked,
      primaryRunningRunId,
      primaryRunningScanType,
      holdedRunningRunId,
      scanStepsVersion,
      getBufferedScanStepsForRun,
      getLatestBufferedNonCredentialStepForRun,
    }),
    [
      getBufferedScanStepsForRun,
      getLatestBufferedNonCredentialStepForRun,
      holdedRunningRunId,
      holdedScopeLocked,
      locksHydrated,
      primaryRunningRunId,
      primaryRunningScanType,
      primaryScopeLocked,
      scanStepsVersion,
    ]
  );

  return <ScanRealtimeContext.Provider value={value}>{children}</ScanRealtimeContext.Provider>;
}

export const useScanRealtime = () => {
  const context = React.useContext(ScanRealtimeContext);
  if (!context) {
    throw new Error('useScanRealtime debe usarse dentro de ScanRealtimeProvider');
  }

  return context;
};
