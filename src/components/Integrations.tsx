import React from 'react';
import { Nunito } from 'next/font/google';
import { SiGmail, SiWhatsapp, SiGoogledrive, SiXero } from 'react-icons/si';

const nunito = Nunito({ subsets: ['latin'], weight: ['600','700','800'] });

const Item = ({
  icon,
  name,
  status,
  statusColor,
  rightBadge,
}: {
  icon: React.ReactNode;
  name: string;
  status: string;
  statusColor: string;
  rightBadge?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between px-4 py-3 border rounded-xl">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-50 border flex items-center justify-center">
        {icon}
      </div>
      <div className="leading-tight">
        <div className={`text-sm font-semibold text-gray-800 ${nunito.className}`}>{name}</div>
        <div className={`text-xs ${statusColor}`}>{status}</div>
      </div>
    </div>
    {rightBadge}
  </div>
);

const Integrations = () => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className={`text-gray-800 mb-4 text-base font-semibold ${nunito.className}`}>Integraciones</h3>
      <div className="space-y-3">
        <Item
          icon={<SiGmail className="text-red-500" size={18} />}
          name="Gmail"
          status="Connected (2 accounts)"
          statusColor="text-green-600"
        />
        <Item
          icon={<SiWhatsapp className="text-green-500" size={18} />}
          name="WhatsApp"
          status="Not connected"
          statusColor="text-gray-400"
        />
        <Item
          icon={<SiGoogledrive className="text-green-500" size={18} />}
          name="Google Drive"
          status="Connected"
          statusColor="text-green-600"
        />
        <Item
          icon={<SiXero className="text-sky-500" size={18} />}
          name="Xero"
          status="Not connected"
          statusColor="text-gray-400"
          rightBadge={<span className="text-xs text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">Beta</span>}
        />
      </div>
    </div>
  );
};

export default Integrations;
