import React from 'react';

const ClerioChat = () => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-800">ClerioChat</h3>
        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">2</span>
      </div>
      <div className="space-y-4">
        <div className="flex items-start">
          <img src="https://i.pravatar.cc/40?u=raul" alt="Raul Asesoria" className="w-10 h-10 rounded-full mr-3" />
          <div>
            <div className="flex items-center">
              <span className="font-semibold">Raul Asesoria</span>
              <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Leído</span>
            </div>
            <p className="text-sm text-gray-600">Necesitamos los últimos trimestres subidos...</p>
          </div>
        </div>
        <div className="flex items-start">
          <img src="https://i.pravatar.cc/40?u=gemma" alt="Gemma Asesoria" className="w-10 h-10 rounded-full mr-3" />
          <div>
            <div className="flex items-center">
              <span className="font-semibold">Gemma Asesoria</span>
              <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Aviso</span>
            </div>
            <p className="text-sm text-gray-600">Hay unas facturas que no me han lleg...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClerioChat;
