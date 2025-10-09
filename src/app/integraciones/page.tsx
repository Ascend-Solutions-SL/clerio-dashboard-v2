import React from 'react';
import { PlugZap, Sparkles } from 'lucide-react';
import Integrations from '@/components/Integrations';

const IntegracionesPage = () => {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      <header className="text-center space-y-3">
        <div className="flex justify-center items-center gap-3 text-blue-700">
          <PlugZap className="h-10 w-10" />
          <h1 className="text-3xl font-semibold">Conecta tus superpoderes digitales</h1>
        </div>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Activa tus integraciones favoritas y deja que Clerio haga el trabajo sucio.
          Cuanto más conectes, más magia liberamos en tu gestoría.
        </p>
      </header>

      <Integrations />

      <section className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 flex items-start gap-4">
        <Sparkles className="h-8 w-8 text-blue-500 mt-1" />
        <div className="space-y-2 text-sm text-blue-900">
          <p className="font-semibold">¿Tu herramienta favorita no aparece?</p>
          <p>
            Estamos ampliando el catálogo. Escríbenos y te avisamos cuando esté lista.
            Prometemos traer cables nuevos cada semana.
          </p>
        </div>
      </section>
    </div>
  );
};

export default IntegracionesPage;
