'use client';

import React from 'react';
import { Loader2, RefreshCw, ScanSearch } from 'lucide-react';
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

const HOLDED_STATUS_EVENT = 'holded-status-changed';

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

export function InvoiceScanControls({ onScanned, showHoldedScan = false }: InvoiceScanControlsProps) {
  const { user } = useDashboardSession();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [holdedLoading, setHoldedLoading] = React.useState(false);
  const [lastScanAt, setLastScanAt] = React.useState<string | null>(null);
  const [emailType, setEmailType] = React.useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);
  const [isHoldedConnected, setIsHoldedConnected] = React.useState(false);

  const loadScanMeta = React.useCallback(async () => {
    if (!user?.id) {
      setEmailType(null);
      setLastScanAt(null);
      setIsHoldedConnected(false);
      setIsBootstrapping(false);
      return;
    }

    setIsBootstrapping(true);

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

    setEmailType(typedAuthUser?.email_type?.trim() || null);
    setLastScanAt(typedLastLog?.created_at ?? null);

    if (showHoldedScan) {
      try {
        if (holdedStatusResult && holdedStatusResult.ok) {
          const payload = (await holdedStatusResult.json()) as HoldedKeyStatusResponse;
          setIsHoldedConnected(Boolean(payload.connected));
        } else {
          setIsHoldedConnected(false);
        }
      } catch {
        setIsHoldedConnected(false);
      }
    } else {
      setIsHoldedConnected(false);
    }

    setIsBootstrapping(false);
  }, [showHoldedScan, user?.id]);

  React.useEffect(() => {
    void loadScanMeta();
  }, [loadScanMeta]);

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

  const handleScan = async () => {
    if (!user?.id || loading) {
      return;
    }

    if (!emailType) {
      toast({
        title: 'No se pudo lanzar el escaneo',
        description: 'El usuario no tiene configurado `email_type`.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await triggerN8nAction(emailType);
      toast({
        title: 'Escaneo iniciado',
        description: `Se ha lanzado el escaneo con la acción ${emailType}.`,
      });
      onScanned?.();
      window.setTimeout(() => {
        void loadScanMeta();
      }, 1200);
    } catch (error) {
      toast({
        title: 'No se pudo lanzar el escaneo',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleHoldedScan = async () => {
    if (!user?.id || holdedLoading) {
      return;
    }

    setHoldedLoading(true);

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
        title: 'Escaneo Holded iniciado',
        description: 'Se ha lanzado correctamente el webhook de Holded.',
      });
      onScanned?.();
    } catch (error) {
      toast({
        title: 'No se pudo lanzar Escanear Holded',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setHoldedLoading(false);
    }
  };

  return (
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
            disabled={holdedLoading || isBootstrapping || !user?.id}
            className="bg-[#ff4254] text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#ff3247] hover:shadow-md active:translate-y-0 focus-visible:ring-2 focus-visible:ring-[#ff9ca6]"
          >
            {holdedLoading ? (
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
          disabled={loading || isBootstrapping || !user?.id}
          className="bg-slate-950 text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-md active:translate-y-0 focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          Escanear Facturas
        </Button>
      </div>
    </div>
  );
}

export default InvoiceScanControls;
