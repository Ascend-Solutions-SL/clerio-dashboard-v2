"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PlugZap, Search } from 'lucide-react';

import { GmailConnectButton } from '@/features/integrations/gmail/components/GmailConnectButton';
import { DriveConnectButton } from '@/features/integrations/drive/components/DriveConnectButton';
import { OutlookConnectButton } from '@/features/integrations/outlook/components/OutlookConnectButton';
import { OneDriveConnectButton } from '@/features/integrations/onedrive/components/OneDriveConnectButton';

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

const integrations: Integration[] = [
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
    status: 'connected',
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
  }, [activeTab, search]);

  useEffect(() => {
    setActiveTab('all');
  }, []);

  const connectedActions: Record<string, React.ReactNode> = {
    gmail: <GmailConnectButton redirectPath="/dashboard/integraciones" />,
    drive: <DriveConnectButton redirectPath="/dashboard/integraciones" />,
    outlook: <OutlookConnectButton redirectPath="/dashboard/integraciones" />,
    onedrive: <OneDriveConnectButton redirectPath="/dashboard/integraciones" />,
  };

  const closeRequestModal = useCallback(() => {
    setIsRequestModalOpen(false);
    setRequestError(null);
  }, []);

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
      setToastMessage('Solicitud enviada. ¡Gracias!');
      setToastFading(false);

      window.setTimeout(() => setToastFading(true), 1800);
      window.setTimeout(() => {
        setToastMessage(null);
        setToastFading(false);
      }, 2400);
    } finally {
      setIsSubmittingRequest(false);
    }
  }, [isSubmittingRequest, requestComments, requestNeedLevel, requestTool]);

  return (
    <div className="-m-8">
      <div className="bg-white pt-8 pb-12">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3 text-blue-700">
                <PlugZap className="h-10 w-10" />
                <h1 className="text-3xl font-semibold">Integraciones</h1>
              </div>
              <p className="text-gray-500 text-base">
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

          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition border ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIntegrations.map((integration) => {
              const isConnected = integration.status === 'connected';
              const integrationAction = connectedActions[integration.id];

              return (
                <div
                  key={integration.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center">
                        {integration.icon}
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-800">{integration.name}</h2>
                        <p className="text-xs font-semibold text-gray-400">
                          {isConnected ? 'Conectado' : 'No conectado'}
                        </p>
                      </div>
                    </div>
                    <div>
                      {integrationAction ?? (
                        <span className="inline-flex select-none items-center rounded-full border border-dashed border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Próximamente
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 leading-relaxed">{integration.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {integration.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <section className="mt-10 rounded-3xl border border-gray-200 bg-gray-50 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-gray-800">¿No ves tu herramienta?</h2>
                <p className="text-sm text-gray-500">
                  Solicita una integración nueva y priorizaremos su desarrollo según la necesidad.
                </p>
              </div>
              <button
                type="button"
                onClick={openRequestModal}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
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
                className="rounded-full border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-50"
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
                  className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={isSubmittingRequest}
                  className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSubmittingRequest ? 'Enviando…' : 'Enviar'}
                </button>
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
