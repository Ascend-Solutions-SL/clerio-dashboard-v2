import React from 'react';
import { HardHat, Wrench } from 'lucide-react';

const ClerioChatPage = () => {
  return (
    <div className="-m-8">
      <div className="bg-white pt-20 pb-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="min-h-[420px] flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-3 text-4xl font-semibold text-blue-700">
              <HardHat className="h-10 w-10 text-yellow-500" />
              <span>ClerioChat en obras</span>
            </div>
            <p className="mt-4 max-w-xl text-gray-600 text-lg">
              <Wrench className="inline-block h-5 w-5 text-orange-500 mr-2 align-middle" />
              Estamos montando la cabina de mandos. Vuelve pronto para chismorrear con el asistente más
              cotilla del despacho.
            </p>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 py-16 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-gray-500">
          Prometemos traer herramientas nuevas a este rincón muy pronto.
        </div>
      </div>
    </div>
  );
};

export default ClerioChatPage;
