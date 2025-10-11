import React from 'react';
import { Nunito } from 'next/font/google';
import Link from 'next/link';
import {
  SiGmail,
  SiWhatsapp,
  SiGoogledrive,
  SiXero,
  SiSlack,
  SiNotion,
  SiDropbox,
  SiTrello,
} from 'react-icons/si';

const nunito = Nunito({ subsets: ['latin'], weight: ['600','700','800'] });

type Tile = {
  icon: React.ReactNode;
  name: string;
  status: string;
  statusColor: string;
  helper?: string;
};

const tiles: Tile[] = [
  {
    icon: <SiGoogledrive className="text-green-500" size={18} />,
    name: 'Drive',
    status: 'Conectado',
    statusColor: 'text-green-600',
  },
  {
    icon: <SiGmail className="text-red-500" size={18} />,
    name: 'Gmail',
    status: 'Conectado',
    statusColor: 'text-green-600',
  },
  {
    icon: <SiWhatsapp className="text-green-500" size={18} />,
    name: 'WhatsApp',
    status: 'No conectado',
    statusColor: 'text-gray-400',
  },
  {
    icon: <SiXero className="text-sky-500" size={18} />,
    name: 'Xero',
    status: 'No conectado',
    statusColor: 'text-gray-400',
  },
  {
    icon: <SiSlack className="text-purple-500" size={18} />,
    name: 'Slack',
    status: 'Conectado',
    statusColor: 'text-green-600',
  },
  {
    icon: <SiNotion className="text-gray-800" size={18} />,
    name: 'Notion',
    status: 'Sin configurar',
    statusColor: 'text-gray-400',
  },
  {
    icon: <SiDropbox className="text-blue-500" size={18} />,
    name: 'Dropbox',
    status: 'Conectado',
    statusColor: 'text-green-600',
  },
  {
    icon: <SiTrello className="text-sky-500" size={18} />,
    name: 'Trello',
    status: 'No conectado',
    statusColor: 'text-gray-400',
  },
];

const Integrations = () => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-gray-800 text-base font-semibold ${nunito.className}`}>Integraciones</h3>
        <Link
          href="/integraciones"
          className="inline-flex items-center px-2 py-1 text-xs font-semibold text-blue-600 transition-all duration-200 rounded hover:text-blue-700 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md hover:shadow-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          Gestionar
        </Link>
      </div>
      <div className="max-h-46 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2.5 auto-rows-min">
          {tiles.map((tile) => (
            <Link
              key={tile.name}
              href="/integraciones"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 flex flex-col gap-1.5 hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-50 border flex items-center justify-center">
                  {tile.icon}
                </div>
                <div className={`text-sm font-semibold text-gray-800 leading-tight ${nunito.className}`}>
                  {tile.name}
                </div>
              </div>
              <div className={`text-[11px] font-medium ${tile.statusColor}`}>
                {tile.status}
              </div>
              {tile.helper && <div className="text-[11px] text-gray-400">{tile.helper}</div>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Integrations;
