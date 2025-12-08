"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { PlugZap, Sparkles, Search } from 'lucide-react';

import { GmailConnectButton } from '@/features/integrations/gmail/components/GmailConnectButton';
import { DriveConnectButton } from '@/features/integrations/drive/components/DriveConnectButton';
import {
  SiAmazon,
  SiAsana,
  SiDropbox,
  SiGmail,
  SiGoogledrive,
  SiHubspot,
  SiNotion,
  SiSage,
  SiShopify,
  SiSlack,
  SiTrello,
  SiWhatsapp,
  SiXero,
  SiZendesk,
} from 'react-icons/si';
import { FaMicrosoft, FaCloud } from 'react-icons/fa';
import { PiCubeFocusBold } from 'react-icons/pi';
import { TbDeviceAnalytics } from 'react-icons/tb';

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
    description: 'Conecta tu cuenta para que Clerio detecte automáticamente tus facturas y las clasifique en el portal.',
    status: 'disconnected',
    categories: ['popular', 'ingresos', 'gastos'],
    icon: <SiGmail className="text-red-500" size={24} />,
  },
  {
    id: 'drive',
    name: 'Drive',
    description: 'Sincroniza las carpetas compartidas de tu empresa para mantener todo el respaldo documental al día.',
    status: 'connected',
    categories: ['popular', 'ingresos', 'gastos'],
    icon: <SiGoogledrive className="text-green-500" size={24} />,
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Detecta facturas recibidas por correo y súbelas automáticamente a tu biblioteca digital.',
    status: 'disconnected',
    categories: ['popular', 'ingresos'],
    icon: <FaMicrosoft className="text-sky-600" size={24} />,
  },
  {
    id: 'holded',
    name: 'Holded',
    description: 'Sincroniza productos, contactos y facturas de tu cuenta Holded con Clerio sin duplicados.',
    status: 'disconnected',
    categories: ['popular', 'gastos'],
    icon: <PiCubeFocusBold className="text-rose-500" size={24} />,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Envía fotos o PDFs y deja que Clerio los convierta en facturas clasificadas al instante.',
    status: 'disconnected',
    categories: ['ingresos', 'gastos'],
    icon: <SiWhatsapp className="text-emerald-500" size={24} />,
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Sincroniza la contabilidad y reduce el tiempo de reconciliación de tus cuentas bancarias.',
    status: 'disconnected',
    categories: ['ingresos', 'gastos'],
    icon: <SiXero className="text-sky-400" size={24} />,
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Automatiza la generación de asientos y mantén tus balances actualizados en tiempo real.',
    status: 'connected',
    categories: ['popular', 'ingresos', 'gastos'],
    icon: <SiSage className="text-emerald-600" size={24} />,
  },
  {
    id: 'amazon',
    name: 'Amazon Business',
    description: 'Recibe todas las facturas de tus compras con el IVA correctamente desglosado.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <SiAmazon className="text-black" size={24} />,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Conecta tus carpetas compartidas para que el equipo contable tenga todo sincronizado.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <SiDropbox className="text-blue-500" size={24} />,
  },
  {
    id: 'wolters',
    name: 'Wolters Kluwer',
    description: 'Integra los envíos a A3 para agilizar la presentación de impuestos sin errores.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <TbDeviceAnalytics className="text-lime-600" size={24} />,
  },
  {
    id: 'onedrive',
    name: 'One Drive',
    description: 'Conecta tu repositorio de archivos corporativos y comparte documentación segura.',
    status: 'disconnected',
    categories: ['ingresos', 'gastos'],
    icon: <FaCloud className="text-sky-500" size={24} />,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Sincroniza pedidos e ingresos de tu ecommerce sin hojas de cálculo intermedias.',
    status: 'disconnected',
    categories: ['ingresos'],
    icon: <SiShopify className="text-emerald-500" size={24} />,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Activa alertas automáticas sobre nuevas facturas o incidencias directamente en tus canales.',
    status: 'connected',
    categories: ['popular', 'ingresos', 'gastos'],
    icon: <SiSlack className="text-purple-500" size={24} />,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Vuelca los resúmenes contables en tus wikis para compartirlos con todo el equipo.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <SiNotion className="text-gray-900" size={24} />,
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Genera tarjetas automáticamente cuando falten documentos o existan incidencias.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <SiTrello className="text-sky-500" size={24} />,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Sincroniza contactos y oportunidades para anticipar los ingresos que vienen en camino.',
    status: 'connected',
    categories: ['popular', 'ingresos'],
    icon: <SiHubspot className="text-orange-500" size={24} />,
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Crea tareas automáticas para revisar gastos críticos y mantener los procesos al día.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <SiAsana className="text-rose-500" size={24} />,
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    description: 'Conecta tus tickets de soporte para adjuntar facturas o documentación del cliente.',
    status: 'disconnected',
    categories: ['gastos'],
    icon: <SiZendesk className="text-emerald-500" size={24} />,
  },
];

const IntegracionesPage = () => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle'
  );
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({
    toolName: '',
    urgencyLevel: '',
    comments: '',
  });
  const [toastState, setToastState] = useState<'hidden' | 'visible' | 'fading'>('hidden');

  useEffect(() => {
    if (toastState !== 'visible') {
      return;
    }

    const fadeTimeout = window.setTimeout(() => setToastState('fading'), 1000);
    const hideTimeout = window.setTimeout(() => setToastState('hidden'), 4000);

    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, [toastState]);

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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Búsqueda"
                className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-700 outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </label>
          </header>

          <div className="border-b border-gray-200">
            <nav className="flex flex-wrap gap-6 text-sm font-semibold text-gray-500">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative pb-3 transition-colors ${
                    activeTab === tab.id ? 'text-gray-900' : 'hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full transition ${
                      activeTab === tab.id ? 'bg-gray-900' : 'bg-transparent'
                    }`}
                  />
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-4 max-h-[540px] overflow-y-auto pr-1 pt-6">
              {filteredIntegrations.map((integration) => (
                <article
                  key={integration.id}
                  className="rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-gray-300 min-h-[170px]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      aria-hidden
                      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-[0_6px_14px_rgba(15,23,42,0.08)]"
                    >
                      <div className="text-3xl">{integration.icon}</div>
                    </div>
                    {integration.id === 'gmail' ? (
                      <GmailConnectButton />
                    ) : integration.id === 'drive' ? (
                      <DriveConnectButton />
                    ) : (
                      <button
                        disabled
                        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border border-dashed border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed"
                      >
                        Próximamente
                      </button>
                    )}
                  </div>
                  <div className="mt-4 space-y-1">
                    <h3 className="text-base font-semibold text-gray-900">{integration.name}</h3>
                    <p className="text-[12px] leading-relaxed text-gray-500">{integration.description}</p>
                  </div>
                </article>
              ))}

              {filteredIntegrations.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
                  No encontramos integraciones con esos filtros.
                </div>
              )}
            </section>

            <section className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 shadow-sm">
              <div className="flex items-start gap-3">
                <Sparkles className="h-8 w-8 text-blue-500 mt-1" />
                <div className="space-y-2 text-sm text-blue-900">
                  <p className="font-semibold">¿Tu herramienta favorita no aparece?</p>
                  <p>
                    Estamos ampliando el catálogo. Escríbenos y te avisamos cuando esté lista.
                    Prometemos traer cables nuevos cada semana.
                  </p>
                </div>
              </div>
              <div className="md:ml-auto">
                <button
                  onClick={() => {
                    setIsRequestModalOpen(true);
                    setRequestStatus('idle');
                    setRequestError(null);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-blue-800 bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-50"
                >
                  Solicitar Integración
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 pb-8 pt-8 border-t border-gray-100" />

      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Solicitar nueva integración</h2>
                <p className="text-sm text-gray-500">
                  Cuéntanos qué herramienta necesitas y qué tan urgente es.
                </p>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Cerrar
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setRequestStatus('submitting');
                setRequestError(null);

                try {
                  const response = await fetch('/api/integration-requests', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      toolName: requestForm.toolName,
                      urgencyLevel: requestForm.urgencyLevel,
                      comments: requestForm.comments,
                    }),
                  });

                  if (!response.ok) {
                    const payload = (await response.json().catch(() => ({}))) as { error?: string };
                    throw new Error(payload.error ?? 'No se pudo registrar la solicitud');
                  }

                  setRequestStatus('success');
                  setRequestForm({ toolName: '', urgencyLevel: '', comments: '' });
                  setIsRequestModalOpen(false);
                  setToastState('visible');
                } catch (formError) {
                  setRequestStatus('error');
                  setRequestError(formError instanceof Error ? formError.message : 'Error desconocido');
                }
              }}
            >
              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">Nombre de la herramienta</span>
                <input
                  required
                  type="text"
                  value={requestForm.toolName}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, toolName: event.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Ej. Hubspot, Airtable, Zapier..."
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">Nivel de necesidad</span>
                <select
                  required
                  value={requestForm.urgencyLevel}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, urgencyLevel: event.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Selecciona una opción
                  </option>
                  <option value="Estaría bien tenerlo">Estaría bien tenerlo</option>
                  <option value="Lo uso muy a menudo">Lo uso muy a menudo</option>
                  <option value="Imprescindible/Urgente">Imprescindible/Urgente</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">Comentarios (opcional)</span>
                <textarea
                  value={requestForm.comments}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, comments: event.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  rows={4}
                  placeholder="Comparte más contexto para ayudarte mejor"
                />
              </label>

              {requestStatus === 'error' && (
                <p className="text-sm text-red-600">{requestError ?? 'Algo salió mal'}</p>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={requestStatus === 'submitting'}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {requestStatus === 'submitting' ? 'Enviando…' : 'Enviar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toastState !== 'hidden' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 pointer-events-none">
          <div
            className={`w-full max-w-md rounded-2xl border border-emerald-200 bg-white px-6 py-4 text-center shadow-xl shadow-emerald-500/20 transition-opacity ${
              toastState === 'visible'
                ? 'duration-200 opacity-100'
                : 'duration-1000 opacity-0'
            }`}
          >
            <p className="text-sm font-semibold text-emerald-600">Solicitud enviada con éxito</p>
            <p className="mt-1 text-sm text-gray-600">
              Te avisaremos en cuanto la integración esté disponible.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegracionesPage;
