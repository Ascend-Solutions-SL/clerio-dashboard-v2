import React from 'react';
import { FcGoogle } from 'react-icons/fc';
import { SiGmail, SiWhatsapp } from 'react-icons/si';

const Integrations = () => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <h3 className="font-bold text-gray-800 mb-4">Integraciones</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center">
            <FcGoogle size={24} className="mr-3" />
            <span>Google Drive</span>
          </div>
          <span className="text-sm text-green-500">Conectado</span>
        </div>
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center">
            <SiGmail size={24} className="mr-3 text-red-500" />
            <span>Gmail</span>
          </div>
          <span className="text-sm text-green-500">Conectado (2)</span>
        </div>
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center">
            <SiWhatsapp size={24} className="mr-3 text-green-500" />
            <span>WhatsApp</span>
          </div>
          <span className="text-sm text-gray-400">No conectado</span>
        </div>
        <div className="flex items-center justify-center p-3 border border-dashed rounded-lg">
          <span className="text-gray-500">Otras...</span>
        </div>
      </div>
    </div>
  );
};

export default Integrations;
