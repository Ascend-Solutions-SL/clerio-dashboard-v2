import React from 'react';
import { HardHat, Wrench } from 'lucide-react';

const ClerioChatPage = () => {
  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center text-center px-6">
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
  );
};

export default ClerioChatPage;
