"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Plus, PlugZap, Search } from 'lucide-react';
import Image from 'next/image';

import { GmailConnectButton } from '@/features/integrations/gmail/components/GmailConnectButton';
import { DriveConnectButton } from '@/features/integrations/drive/components/DriveConnectButton';
import { OutlookConnectButton } from '@/features/integrations/outlook/components/OutlookConnectButton';
import { OneDriveConnectButton } from '@/features/integrations/onedrive/components/OneDriveConnectButton';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

const HOLDED_STATUS_EVENT = 'holded-status-changed';
const HOLDED_SCAN_IN_PROGRESS_EVENT = 'holded-scan-in-progress-changed';
const HOLDED_SCAN_IN_PROGRESS_STORAGE_KEY = 'holded-scan-in-progress';
const SCAN_TOAST_DURATION_MS = 3000;
const SCAN_TOAST_BASE_CLASS =
  'w-[420px] max-w-[calc(100vw-2rem)] min-h-[104px] data-[state=closed]:slide-out-to-right-0 data-[state=closed]:fade-out-100';
const SCAN_TOAST_SUCCESS_CLASS = `${SCAN_TOAST_BASE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-950`;
const SCAN_TOAST_HOLDED_START_CLASS = `${SCAN_TOAST_BASE_CLASS} border-[#ff4254] bg-white text-[#7f1d24]`;
const SCAN_TOAST_LOGO_SIZE = 40;
const SCAN_TOAST_LOGO_CLASS = 'pointer-events-none absolute right-5 top-1/2 h-10 w-10 -translate-y-1/2 object-contain';
const SCAN_TOAST_DESCRIPTION_CLASS = 'block pr-16';

type ScanStartWebhookResponse = {
  run_id?: string | null;
  user_uid?: string | null;
  scan_type?: string | null;
};

type ScanStepRealtimeRow = {
  run_id?: string | number | null;
  user_uid?: string | null;
  step?: string | null;
  status?: string | null;
  progress_total?: number | string | null;
  progress_current?: number | string | null;
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

type IntegrationsStatusCacheEntry = {
  integrations: Integration[];
  holdedApiKeyMasked: string | null;
};

const integrationsStatusCache = new Map<string, IntegrationsStatusCacheEntry>();
let lastIntegrationsStatusCacheKey: string | null = null;

type IntegrationCategory = 'popular' | 'ingresos' | 'gastos';
type IntegrationStatus = 'connected' | 'disconnected';

type Integration = {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  categories: IntegrationCategory[];
  icon: React.ReactNode;
};

const tabs = [
  { id: 'all', label: 'Todo' },
  { id: 'popular', label: 'Popular' },
  { id: 'ingresos', label: 'Ingresos' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'connected', label: 'Conectados' },
];

const baseIntegrations: Integration[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description:
      'Conecta tu cuenta para que Clerio detecte automáticamente tus facturas y las clasifique en el portal.',
    status: 'disconnected',
    categories: ['popular', 'ingresos', 'gastos'],
    icon: <img src="/brand/tab_integraciones/gmail_logo.png" alt="Gmail" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'drive',
    name: 'Drive',
    description:
      'Sincroniza las carpetas compartidas de tu empresa para mantener todo el respaldo documental al día.',
    status: 'disconnected',
    categories: ['popular', 'ingresos', 'gastos'],
    icon: <img src="/brand/tab_integraciones/drive_logo.png" alt="Drive" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Detecta facturas recibidas por correo y súbelas automáticamente a tu biblioteca digital.',
    status: 'disconnected',
    categories: ['popular', 'ingresos'],
    icon: <img src="/brand/tab_integraciones/outlook_logo.png" alt="Outlook" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'onedrive',
    name: 'One Drive',
    description: 'Conecta tu repositorio de archivos corporativos y comparte documentación segura.',
    status: 'disconnected',
    categories: ['ingresos', 'gastos'],
    icon: <img src="/brand/tab_integraciones/onedrive_logo.png" alt="OneDrive" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'holded',
    name: 'Holded',
    description: 'Sincroniza productos, contactos y facturas de tu cuenta Holded con Clerio sin duplicados.',
    status: 'disconnected',
    categories: ['popular', 'gastos'],
    icon: <img src="/brand/tab_integraciones/holded_logo.png" alt="Holded" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Envía fotos o PDFs y deja que Clerio los convierta en facturas clasificadas al instante.',
    status: 'disconnected',
    categories: ['ingresos', 'gastos'],
    icon: <img src="/brand/tab_integraciones/whatsapp_logo.png" alt="WhatsApp" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Sincroniza la contabilidad y reduce el tiempo de reconciliación de tus cuentas bancarias.',
    status: 'disconnected',
    categories: ['ingresos', 'gastos'],
    icon: <img src="/brand/tab_integraciones/xero_logo.png" alt="Xero" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Automatiza la generación de asientos y mantén tus balances actualizados en tiempo real.',
    status: 'connected',
    categories: ['popular', 'ingresos', 'gastos'],
    icon: <img src="/brand/tab_integraciones/sage_logo.png" alt="Sage" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'amazon',
    name: 'Amazon Business',
    description: 'Recibe todas las facturas de tus compras con el IVA correctamente desglosado.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <img src="/brand/tab_integraciones/amazon_logo.png" alt="Amazon" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Conecta tus carpetas compartidas para que el equipo contable tenga todo sincronizado.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <img src="/brand/tab_integraciones/dropbox_logo.png" alt="Dropbox" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'wolters',
    name: 'Wolters Kluwer',
    description: 'Integra los envíos a A3 para agilizar la presentación de impuestos sin errores.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <img src="/brand/tab_integraciones/wolters_logo.png" alt="Wolters Kluwer" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Sincroniza pedidos e ingresos de tu ecommerce sin hojas de cálculo intermedias.',
    status: 'disconnected',
    categories: ['ingresos'],
    icon: <img src="/brand/tab_integraciones/shopify_logo.png" alt="Shopify" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Activa alertas automáticas sobre nuevas facturas o incidencias directamente en tus canales.',
    status: 'connected',
    categories: ['popular', 'ingresos', 'gastos'],
    icon: <img src="/brand/tab_integraciones/slack_logo.png" alt="Slack" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Vuelca los resúmenes contables en tus wikis para compartirlos con todo el equipo.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <img src="/brand/tab_integraciones/notion_logo.png" alt="Notion" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Genera tarjetas automáticamente cuando falten documentos o existan incidencias.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <img src="/brand/tab_integraciones/trello_logo.png" alt="Trello" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Sincroniza contactos y oportunidades para anticipar los ingresos que vienen en camino.',
    status: 'connected',
    categories: ['popular', 'ingresos'],
    icon: <img src="/brand/tab_integraciones/hubspot_logo.png" alt="HubSpot" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Crea tareas automáticas para revisar gastos críticos y mantener los procesos al día.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <img src="/brand/tab_integraciones/asana_logo.png" alt="Asana" className="h-8 w-8 object-contain" />,
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    description: 'Conecta tus tickets de soporte para adjuntar facturas o documentación del cliente.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <img src="/brand/tab_integraciones/zendesk_logo.png" alt="Zendesk" className="h-8 w-8 object-contain" />,
  },
];

const IntegracionesPage = () => {
  const { user, isLoading } = useDashboardSession();
  const { toast } = useToast();
  const cacheKey = user?.id ?? '';
  const resolvedCacheKey = cacheKey || lastIntegrationsStatusCacheKey || '';
  const cachedStatus = resolvedCacheKey ? integrationsStatusCache.get(resolvedCacheKey) : null;
  const [integrations, setIntegrations] = useState<Integration[]>(() => cachedStatus?.integrations ?? baseIntegrations);
  const integrationsRef = useRef<Integration[]>(baseIntegrations);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestTool, setRequestTool] = useState('');
  const [requestNeedLevel, setRequestNeedLevel] = useState<'Urgente' | 'Media' | 'Baja'>('Media');
  const [requestComments, setRequestComments] = useState('');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastFading, setToastFading] = useState(false);
  const [hoveredDisconnectId, setHoveredDisconnectId] = useState<string | null>(null);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isHoldedModalOpen, setIsHoldedModalOpen] = useState(false);
  const [holdedApiKeyInput, setHoldedApiKeyInput] = useState('');
  const [holdedApiKeyMasked, setHoldedApiKeyMasked] = useState<string | null>(() => cachedStatus?.holdedApiKeyMasked ?? null);
  const [holdedApiKeyError, setHoldedApiKeyError] = useState<string | null>(null);
  const [isSavingHoldedApiKey, setIsSavingHoldedApiKey] = useState(false);
  const [isRemovingHoldedApiKey, setIsRemovingHoldedApiKey] = useState(false);
  const [isEditingHoldedApiKey, setIsEditingHoldedApiKey] = useState(false);
  const [isStatusesLoading, setIsStatusesLoading] = useState(() => !Boolean(cachedStatus));

  useEffect(() => {
    if (!cacheKey) {
      if (isLoading) {
        return;
      }

      setIntegrations(baseIntegrations);
      setHoldedApiKeyMasked(null);
      setIsStatusesLoading(true);
      lastIntegrationsStatusCacheKey = null;
      return;
    }

    lastIntegrationsStatusCacheKey = cacheKey;
    const cached = integrationsStatusCache.get(cacheKey);
    if (cached) {
      setIntegrations(cached.integrations);
      setHoldedApiKeyMasked(cached.holdedApiKeyMasked);
      setIsStatusesLoading(false);
      return;
    }

    setIntegrations(baseIntegrations);
    setHoldedApiKeyMasked(null);
    setIsStatusesLoading(true);
  }, [cacheKey, isLoading]);

  const filteredIntegrations = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    return integrations.filter((integration) => {
      const matchesTab =
        activeTab === 'all'
          ? true
          : activeTab === 'connected'
            ? integration.status === 'connected'
            : integration.categories.includes(activeTab as IntegrationCategory);

      const matchesSearch =
        !normalizedQuery ||
        integration.name.toLowerCase().includes(normalizedQuery) ||
        integration.description.toLowerCase().includes(normalizedQuery);

      return matchesTab && matchesSearch;
    });
  }, [activeTab, integrations, search]);

  useEffect(() => {
    integrationsRef.current = integrations;
  }, [integrations]);

  useEffect(() => {
    if (!cacheKey) {
      return;
    }

    integrationsStatusCache.set(cacheKey, {
      integrations,
      holdedApiKeyMasked,
    });
  }, [cacheKey, holdedApiKeyMasked, integrations]);

  useEffect(() => {
    let isMounted = true;

    if (!cacheKey) {
      return () => {
        isMounted = false;
      };
    }

    const hasCachedStatus = integrationsStatusCache.has(cacheKey);

    if (isMounted && hasCachedStatus) {
      setIsStatusesLoading(false);
    }

    const fetchStatuses = async () => {
      if (isMounted && !hasCachedStatus) {
        setIsStatusesLoading(true);
      }

      const endpoints: Partial<Record<Integration['id'], string>> = {
        gmail: '/api/gmail/status',
        drive: '/api/drive/status',
        outlook: '/api/oauth/outlook/status',
        onedrive: '/api/oauth/onedrive/status',
        holded: '/api/holded/key',
      };

      const entries = Object.entries(endpoints) as Array<[Integration['id'], string]>;

      const results = await Promise.all(
        entries.map(async ([id, url]) => {
          try {
            const response = await fetch(url, {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            });

            if (!response.ok) {
              return [id, { connected: false, maskedApiKey: null }] as const;
            }

            const payload = (await response.json()) as { connected?: boolean; masked_api_key?: string | null };
            return [id, { connected: Boolean(payload.connected), maskedApiKey: payload.masked_api_key ?? null }] as const;
          } catch {
            return [id, { connected: false, maskedApiKey: null }] as const;
          }
        })
      );

      if (!isMounted) return;

      const connectedMap = Object.fromEntries(results) as Partial<
        Record<Integration['id'], { connected: boolean; maskedApiKey: string | null }>
      >;

      const holdedMeta = connectedMap.holded;
      const nextHoldedApiKeyMasked = holdedMeta?.maskedApiKey ?? null;
      setHoldedApiKeyMasked(nextHoldedApiKeyMasked);

      const nextIntegrations = integrationsRef.current.map((integration) => {
        const statusMeta = connectedMap[integration.id];
        if (!statusMeta) {
          return integration;
        }

        return {
          ...integration,
          status: (statusMeta.connected ? 'connected' : 'disconnected') as IntegrationStatus,
        };
      });

      const didChange = JSON.stringify(integrationsRef.current) !== JSON.stringify(nextIntegrations);
      if (didChange) {
        setIntegrations(nextIntegrations);
      }

      integrationsStatusCache.set(cacheKey, {
        integrations: didChange ? nextIntegrations : integrationsRef.current,
        holdedApiKeyMasked: nextHoldedApiKeyMasked,
      });
      lastIntegrationsStatusCacheKey = cacheKey;

      window.dispatchEvent(new CustomEvent(HOLDED_STATUS_EVENT, { detail: { connected: Boolean(holdedMeta?.connected) } }));

      if (isMounted) {
        setIsStatusesLoading(false);
      }
    };

    void fetchStatuses();

    return () => {
      isMounted = false;
    };
  }, [cacheKey]);

  useEffect(() => {
    setActiveTab('all');
  }, []);

  const connectedActions: Record<string, React.ReactNode> = {
    gmail: <GmailConnectButton redirectPath="/dashboard/integraciones" />,
    drive: <DriveConnectButton redirectPath="/dashboard/integraciones" />,
    outlook: <OutlookConnectButton redirectPath="/dashboard/integraciones" />,
    onedrive: <OneDriveConnectButton redirectPath="/dashboard/integraciones" />,
  };

  const startOAuth = useCallback((integrationId: string) => {
    const startPathById: Partial<Record<Integration['id'], string>> = {
      gmail: '/api/gmail/oauth/start',
      drive: '/api/drive/oauth/start',
      outlook: '/api/oauth/outlook/start',
      onedrive: '/api/oauth/onedrive/start',
    };

    const startPath = startPathById[integrationId as Integration['id']];
    if (!startPath) return;

    const url = new URL(startPath, window.location.origin);
    url.searchParams.set('redirect', '/dashboard/integraciones');
    window.location.href = url.toString();
  }, []);

  const closeRequestModal = useCallback(() => {
    setIsRequestModalOpen(false);
    setRequestError(null);
  }, []);

  const openHoldedModal = useCallback(() => {
    const holdedIntegration = integrationsRef.current.find((integration) => integration.id === 'holded');
    const isHoldedConnected = holdedIntegration?.status === 'connected';

    setHoldedApiKeyError(null);
    setIsEditingHoldedApiKey(false);
    setHoldedApiKeyInput(isHoldedConnected ? (holdedApiKeyMasked ?? '') : '');
    setIsHoldedModalOpen(true);
  }, [holdedApiKeyMasked]);

  const closeHoldedModal = useCallback(() => {
    setIsHoldedModalOpen(false);
    setHoldedApiKeyError(null);
    setHoldedApiKeyInput('');
    setIsEditingHoldedApiKey(false);
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastFading(false);

    window.setTimeout(() => setToastFading(true), 1800);
    window.setTimeout(() => {
      setToastMessage(null);
      setToastFading(false);
    }, 2400);
  }, []);

  const integrationWebhookValue = useCallback((id: string) => {
    if (id === 'gmail') return 'gmail';
    if (id === 'drive') return 'googledrive';
    if (id === 'outlook') return 'outlook';
    if (id === 'onedrive') return 'onedrive';
    return null;
  }, []);

  const confirmDisconnect = useCallback(
    async (integrationId: string) => {
      if (!user?.id) {
        showToast('No se pudo desconectar: usuario no identificado');
        setConfirmDisconnectId(null);
        return;
      }

      const integracion = integrationWebhookValue(integrationId);
      if (!integracion) {
        showToast('No se pudo desconectar: integración no soportada');
        setConfirmDisconnectId(null);
        return;
      }

      if (isDisconnecting) {
        return;
      }

      const previousIntegrations = integrationsRef.current;
      const optimisticDisconnectIds =
        integrationId === 'gmail'
          ? ['gmail', 'drive']
          : integrationId === 'drive'
            ? ['drive', 'gmail']
            : integrationId === 'outlook'
              ? ['outlook', 'onedrive']
              : integrationId === 'onedrive'
                ? ['onedrive', 'outlook']
            : [integrationId];

      setIntegrations((prev) =>
        prev.map((integration) =>
          optimisticDisconnectIds.includes(integration.id)
            ? {
                ...integration,
                status: 'disconnected',
              }
            : integration
        )
      );

      setIsDisconnecting(true);
      try {
        const response = await fetch(
          'https://v-ascendsolutions.app.n8n.cloud/webhook/revocar-integracion',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_uid: user.id,
              integracion,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        showToast(`Integración desconectada: ${integracion}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Error desconocido';
        void reason;
        setIntegrations(previousIntegrations);
        showToast(`No se pudo desconectar. Contacte con soporte (hola@clerio.es).`);
      } finally {
        setIsDisconnecting(false);
        setConfirmDisconnectId(null);
        setHoveredDisconnectId(null);
      }
    },
    [integrationWebhookValue, isDisconnecting, showToast, user?.id]
  );

  const openRequestModal = useCallback(() => {
    setRequestError(null);
    setRequestTool('');
    setRequestNeedLevel('Media');
    setRequestComments('');
    setIsRequestModalOpen(true);
  }, []);

  const submitRequest = useCallback(async () => {
    if (isSubmittingRequest) {
      return;
    }

    setRequestError(null);

    const herramienta = requestTool.trim();
    if (!herramienta) {
      setRequestError('Herramienta es obligatoria');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const res = await fetch('/api/solicitudes-integracion', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          herramienta,
          nivel_necesidad: requestNeedLevel,
          comentarios: requestComments,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setRequestError(payload?.error ?? 'No se pudo enviar la solicitud');
        return;
      }

      setIsRequestModalOpen(false);
      showToast('Solicitud enviada. ¡Gracias!');
    } finally {
      setIsSubmittingRequest(false);
    }
  }, [isSubmittingRequest, requestComments, requestNeedLevel, requestTool, showToast]);

  const saveHoldedApiKey = useCallback(async () => {
    if (isSavingHoldedApiKey) {
      return;
    }

    const holdedIntegration = integrationsRef.current.find((integration) => integration.id === 'holded');
    const isHoldedConnected = holdedIntegration?.status === 'connected';

    if (isHoldedConnected && !isEditingHoldedApiKey) {
      return;
    }

    const apiKey = holdedApiKeyInput.trim();
    if (!apiKey) {
      setHoldedApiKeyError('La API key es obligatoria');
      return;
    }

    setIsSavingHoldedApiKey(true);
    setHoldedApiKeyError(null);

    try {
      const response = await fetch('/api/holded/key', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_key: apiKey }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; connected?: boolean; masked_api_key?: string | null }
        | null;

      if (!response.ok || !payload?.connected) {
        setHoldedApiKeyError(payload?.error ?? 'No se pudo guardar la API key');
        return;
      }

      setIntegrations((prev) =>
        prev.map((integration) =>
          integration.id === 'holded'
            ? {
                ...integration,
                status: 'connected',
              }
            : integration
        )
      );

      setHoldedApiKeyMasked(payload.masked_api_key ?? null);
      setIsHoldedModalOpen(false);
      setHoldedApiKeyInput('');
      setIsEditingHoldedApiKey(false);
      showToast('Holded conectado correctamente');

      window.dispatchEvent(new CustomEvent(HOLDED_STATUS_EVENT, { detail: { connected: true } }));

      void (async () => {
        if (getHoldedScanInProgress()) {
          return;
        }

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
          const scanResponse = await fetch('/api/holded/scan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!scanResponse.ok) {
            throw new Error(`Webhook respondió con ${scanResponse.status}`);
          }

          const payload = (await scanResponse.json().catch(() => null)) as ScanStartWebhookResponse | null;
          const runId = typeof payload?.run_id === 'string' && payload.run_id.trim().length > 0 ? payload.run_id.trim() : null;
          const userUid = typeof payload?.user_uid === 'string' && payload.user_uid.trim().length > 0 ? payload.user_uid.trim() : user?.id ?? null;

          if (!runId || !userUid) {
            throw new Error('El webhook de Holded no devolvió run_id/user_uid válidos.');
          }

          console.info('[holded:integraciones] webhook ack', {
            runId,
            userUid,
            scanType: payload?.scan_type,
          });

          await new Promise<void>((resolve, reject) => {
            let isSettled = false;
            const timeoutId = window.setTimeout(() => {
              if (isSettled) {
                return;
              }
              isSettled = true;
              console.error('[holded:integraciones] realtime timeout waiting for completion', { runId, userUid });
              void supabase.removeChannel(channel);
              reject(new Error('Tiempo de espera agotado al escuchar logs realtime de Holded.'));
            }, 8 * 60 * 1000);

            const settle = (kind: 'resolve' | 'reject', error?: Error) => {
              if (isSettled) {
                return;
              }
              isSettled = true;
              window.clearTimeout(timeoutId);
              void supabase.removeChannel(channel);
              if (kind === 'resolve') {
                resolve();
                return;
              }
              reject(error ?? new Error('Se cerró la escucha realtime de Holded.'));
            };

            const channel = supabase
              .channel(`holded_scan_integraciones_${runId}`)
              .on(
                'postgres_changes',
                {
                  event: '*',
                  schema: 'public',
                  table: 'scan_steps',
                },
                (eventPayload: { new?: unknown }) => {
                  const row = (eventPayload.new as ScanStepRealtimeRow | null) ?? null;
                  if (!row) {
                    console.info('[holded:integraciones] payload ignored: missing payload.new', eventPayload);
                    return;
                  }

                  const rowRunId = row.run_id != null ? String(row.run_id) : null;
                  const rowUserUid = typeof row.user_uid === 'string' ? row.user_uid : null;
                  const rowStep = typeof row.step === 'string' ? row.step.trim().toLowerCase() : '';
                  const rowStatus = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
                  const rowProgressTotal = toNonNegativeInteger(row.progress_total);
                  const rowProgressCurrent = toNonNegativeInteger(row.progress_current);
                  const isSameRun = rowRunId === runId;
                  const isSameUser = !rowUserUid || rowUserUid === userUid;
                  const isEndStep = rowStep === 'holded_scrapper_end';
                  const isSuccess = rowStatus === 'success';

                  console.info('[holded:integraciones] step payload received', {
                    rowRunId,
                    rowUserUid,
                    rowStep,
                    rowStatus,
                    rowProgressTotal,
                    rowProgressCurrent,
                    runId,
                    userUid,
                    isSameRun,
                    isSameUser,
                    isEndStep,
                    isSuccess,
                  });

                  if (!isSameRun || !isSameUser) {
                    return;
                  }

                  if (isEndStep && isSuccess) {
                    console.info('[holded:integraciones] finishing run from scan_steps', runId);
                    settle('resolve');
                  }
                }
              )
              .subscribe((status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR', err?: Error) => {
                if (status === 'SUBSCRIBED') {
                  console.info('[holded:integraciones] subscribed', { runId, userUid });
                  return;
                }

                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                  console.error('[holded:integraciones] channel status', { status, err, runId, userUid });
                  settle('reject', err ?? new Error(`Estado realtime inesperado: ${status}`));
                  return;
                }

                console.info('[holded:integraciones] channel status', { status, runId, userUid });
              });
          });

          toast({
            title: 'Escaneo finalizado',
            description: 'Se ha finalizado el escaneo de facturas de Holded.',
            duration: SCAN_TOAST_DURATION_MS,
            className: SCAN_TOAST_SUCCESS_CLASS,
          });
        } catch (scanError) {
          toast({
            title: 'No se pudo lanzar Escanear Holded',
            description: scanError instanceof Error ? scanError.message : 'Intenta nuevamente.',
            variant: 'destructive',
            className: SCAN_TOAST_BASE_CLASS,
          });
        } finally {
          setHoldedScanInProgress(false);
        }
      })();
    } finally {
      setIsSavingHoldedApiKey(false);
    }
  }, [holdedApiKeyInput, isEditingHoldedApiKey, isSavingHoldedApiKey, showToast, toast]);

  const removeHoldedApiKey = useCallback(async () => {
    if (isRemovingHoldedApiKey) {
      return;
    }

    setIsRemovingHoldedApiKey(true);
    setHoldedApiKeyError(null);

    try {
      const response = await fetch('/api/holded/key', {
        method: 'DELETE',
        credentials: 'include',
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setHoldedApiKeyError(payload?.error ?? 'No se pudo desconectar Holded');
        return;
      }

      setIntegrations((prev) =>
        prev.map((integration) =>
          integration.id === 'holded'
            ? {
                ...integration,
                status: 'disconnected',
              }
            : integration
        )
      );

      setHoldedApiKeyMasked(null);
      setHoldedApiKeyInput('');
      setIsEditingHoldedApiKey(false);
      setIsHoldedModalOpen(false);
      showToast('Holded desconectado correctamente');

      window.dispatchEvent(new CustomEvent(HOLDED_STATUS_EVENT, { detail: { connected: false } }));
    } finally {
      setIsRemovingHoldedApiKey(false);
    }
  }, [isRemovingHoldedApiKey, showToast]);

  return (
    <div className="-m-8">
      <div className="bg-white pt-6 pb-10">
        <div className="mx-auto max-w-6xl space-y-6 px-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="flex items-center gap-2.5 text-blue-700">
                <PlugZap className="h-10 w-10" />
                <h1 className="text-3xl font-bold text-blue-700">Integraciones</h1>
              </div>
              <p className="text-gray-500">
                Conecta tus herramientas y deja que Clerio sincronice automáticamente tus facturas de ingresos y gastos.
              </p>
            </div>

            <label className="relative w-full md:w-72">
              <span className="sr-only">Buscar integraciones</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar integración"
                className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-11 pr-4 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </header>

          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white border-blue-600 hover:shadow-md'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700 hover:shadow-md'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openRequestModal}
              className="inline-flex items-center justify-center gap-1.5 self-start rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 hover:shadow-md"
            >
              <Plus className="h-3.5 w-3.5" />
              Solicitar integración
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredIntegrations.map((integration) => {
              const isConnected = integration.status === 'connected';
              const integrationAction = connectedActions[integration.id];
              const supportsDisconnect =
                integration.id === 'gmail' ||
                integration.id === 'drive' ||
                integration.id === 'outlook' ||
                integration.id === 'onedrive';
              const isHolded = integration.id === 'holded';
              const supportsStatusCheck = supportsDisconnect || isHolded;
              const isConfirmingDisconnect = confirmDisconnectId === integration.id;
              const showDisconnectAction =
                isConnected && supportsDisconnect && hoveredDisconnectId === integration.id;

              return (
                <div
                  key={integration.id}
                  onClick={() => {
                    if (isHolded) {
                      openHoldedModal();
                    }
                  }}
                  className={`relative flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${
                    isHolded ? 'cursor-pointer transition-shadow hover:shadow-md' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white">
                        {integration.icon}
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-gray-800">{integration.name}</h2>
                      </div>
                    </div>
                    <div>
                      {supportsStatusCheck && isStatusesLoading ? (
                        <span className="inline-flex select-none items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-500">
                          Cargando...
                        </span>
                      ) : isConnected && supportsDisconnect ? (
                        <button
                          type="button"
                          onMouseEnter={() => setHoveredDisconnectId(integration.id)}
                          onMouseLeave={() => setHoveredDisconnectId((prev) => (prev === integration.id ? null : prev))}
                          onFocus={() => setHoveredDisconnectId(integration.id)}
                          onBlur={() => setHoveredDisconnectId((prev) => (prev === integration.id ? null : prev))}
                          onClick={() => {
                            if (showDisconnectAction) {
                              setConfirmDisconnectId(integration.id);
                            }
                          }}
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${
                            showDisconnectAction
                              ? 'bg-slate-900 text-white border-slate-900 hover:shadow-md'
                              : 'bg-emerald-500 text-white border-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.35)] hover:shadow-[0_8px_20px_rgba(16,185,129,0.42)]'
                          }`}
                        >
                          {showDisconnectAction ? 'Desconectar' : 'Conectado'}
                        </button>
                      ) : !isConnected && supportsDisconnect ? (
                        <button
                          type="button"
                          onClick={() => startOAuth(integration.id)}
                          className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-700 transition-transform duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-600 hover:shadow-md"
                        >
                          Conectar
                        </button>
                      ) : isHolded ? (
                        <button
                          type="button"
                          onClick={openHoldedModal}
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${
                            isConnected
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.35)] hover:shadow-[0_8px_20px_rgba(16,185,129,0.42)]'
                              : 'border-gray-200 bg-gray-100 text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:shadow-md'
                          }`}
                        >
                          {isConnected ? 'Conectado' : 'Conectar'}
                        </button>
                      ) : (
                        integrationAction ?? (
                          <span className="inline-flex select-none items-center rounded-full border border-dashed border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                            Próximamente
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <p className="text-xs leading-5 text-gray-500">{integration.description}</p>

                  {isConfirmingDisconnect ? (
                    <div className="absolute inset-0 z-10 grid place-items-center">
                      <div className="absolute inset-0 rounded-2xl bg-white/40 backdrop-blur-sm" />
                      <div className="relative z-10 w-[90%] max-w-[320px] rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-xl">
                        <div className="text-center text-[12px] font-semibold leading-snug text-slate-900">
                          <div>¿Estas seguro de que quieres</div>
                          <div className="mt-0.5">
                            <span className="relative inline-block px-0.5">
                              <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-slate-400/60 via-slate-600/70 to-slate-400/60" />
                              <span className="relative">desconectar {integration.name}</span>
                            </span>
                            ?
                          </div>
                        </div>

                        {integration.id === 'gmail' ||
                        integration.id === 'drive' ||
                        integration.id === 'outlook' ||
                        integration.id === 'onedrive' ? (
                          <div className="mt-3 rounded-xl border border-red-200 bg-red-50/40 px-3 py-1.5">
                            <div className="flex items-start justify-center gap-2 text-center text-[11px] font-semibold text-red-700">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                              <div>
                                {integration.id === 'gmail' ? (
                                  <div>
                                    <div>ATENCIÓN: También se</div>
                                    <div>desconectará Google Drive</div>
                                  </div>
                                ) : integration.id === 'drive' ? (
                                  <div>
                                    <div>ATENCIÓN: También se</div>
                                    <div>desconectará Gmail</div>
                                  </div>
                                ) : integration.id === 'outlook' ? (
                                  <div>
                                    <div>ATENCIÓN: También se</div>
                                    <div>desconectará One Drive</div>
                                  </div>
                                ) : (
                                  <div>
                                    <div>ATENCIÓN: También se</div>
                                    <div>desconectará Outlook</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            disabled={isDisconnecting}
                            onClick={() => confirmDisconnect(integration.id)}
                            className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-700 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-gray-200 hover:shadow-md disabled:opacity-60"
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            disabled={isDisconnecting}
                            onClick={() => setConfirmDisconnectId(null)}
                            className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-500 px-4 py-1.5 text-xs font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-md disabled:opacity-60"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <section className="mt-8 rounded-3xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-gray-800">¿No ves tu herramienta?</h2>
                <p className="text-xs text-gray-500">
                  Solicita una integración nueva y priorizaremos su desarrollo según la necesidad.
                </p>
              </div>
              <button
                type="button"
                onClick={openRequestModal}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
              >
                Solicitar integración
              </button>
            </div>
          </section>
        </div>
      </div>

      {isRequestModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={closeRequestModal}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Solicitar integración</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Cuéntanos qué herramienta necesitas y con qué urgencia.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRequestModal}
                className="rounded-full border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-600 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700" htmlFor="requestTool">
                  Herramienta
                </label>
                <input
                  id="requestTool"
                  value={requestTool}
                  onChange={(e) => setRequestTool(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Stripe, QuickBooks..."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700" htmlFor="requestNeed">
                  Nivel de necesidad
                </label>
                <select
                  id="requestNeed"
                  value={requestNeedLevel}
                  onChange={(e) => setRequestNeedLevel(e.target.value as 'Urgente' | 'Media' | 'Baja')}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Urgente">Urgente</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700" htmlFor="requestComments">
                  Comentarios
                </label>
                <textarea
                  id="requestComments"
                  value={requestComments}
                  onChange={(e) => setRequestComments(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Describe tu caso de uso..."
                />
              </div>

              {requestError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{requestError}</div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeRequestModal}
                  className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={isSubmittingRequest}
                  className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:opacity-60"
                >
                  {isSubmittingRequest ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isHoldedModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Cerrar" onClick={closeHoldedModal} className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Conectar Holded</h3>
                <p className="mt-1 text-sm text-gray-500">Introduce tu API key para activar la integración de Holded.</p>
              </div>
              <button
                type="button"
                onClick={closeHoldedModal}
                className="rounded-full border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-600 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700" htmlFor="holdedApiKey">
                  API key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="holdedApiKey"
                    value={holdedApiKeyInput}
                    onChange={(e) => setHoldedApiKeyInput(e.target.value)}
                    disabled={Boolean(holdedApiKeyMasked) && !isEditingHoldedApiKey}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="Pega aquí tu API key de Holded"
                  />
                  {holdedApiKeyMasked ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingHoldedApiKey(true);
                        setHoldedApiKeyInput('');
                        setHoldedApiKeyError(null);
                      }}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md"
                    >
                      Editar
                    </button>
                  ) : null}
                </div>
              </div>

              {holdedApiKeyError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {holdedApiKeyError}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-2">
                <div>
                  {holdedApiKeyMasked ? (
                    <button
                      type="button"
                      onClick={removeHoldedApiKey}
                      disabled={isRemovingHoldedApiKey || isSavingHoldedApiKey}
                      className="rounded-full border border-red-200 bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-md disabled:opacity-60"
                    >
                      {isRemovingHoldedApiKey ? 'Desconectando…' : 'Desconectar'}
                    </button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeHoldedModal}
                    className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveHoldedApiKey}
                    disabled={
                      isSavingHoldedApiKey ||
                      isRemovingHoldedApiKey ||
                      (Boolean(holdedApiKeyMasked) && !isEditingHoldedApiKey)
                    }
                    className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:opacity-60"
                  >
                    {isSavingHoldedApiKey ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className={`rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-800 shadow-lg transition-opacity duration-500 ${
              toastFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {toastMessage}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default IntegracionesPage;
