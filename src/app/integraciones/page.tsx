"use client";

import React, { useMemo, useState } from 'react';
import { PlugZap, Sparkles, Search } from 'lucide-react';
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
    status: 'connected',
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
                <h1 className="text-3xl font-semibold">Integraciones &amp; workflows</h1>
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
                    <button
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                        integration.status === 'connected'
                          ? 'bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {integration.status === 'connected' ? 'Conectado' : 'Conectar'}
                    </button>
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
                <button className="inline-flex items-center justify-center rounded-lg border border-blue-800 bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-50">
                  Solicitar Integración
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 pb-8 pt-8 border-t border-gray-100" />
    </div>
  );
};

export default IntegracionesPage;
