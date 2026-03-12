"use client";

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { supabase } from '@/lib/supabase';

const Header = () => {
  const { user, isLoading } = useDashboardSession();
  const [isPending, startTransition] = useTransition();
  const [pendingValidationCount, setPendingValidationCount] = useState<number>(0);

  useEffect(() => {
    const empresaId = user?.empresaId != null ? Number(user.empresaId) : null;
    if (!empresaId) {
      setPendingValidationCount(0);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const { count } = await supabase
        .from('facturas')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('factura_validada', false);

      if (cancelled) {
        return;
      }
      setPendingValidationCount(count ?? 0);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [user?.empresaId]);

  const handleLogout = () => {
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (error) {
        console.error('Error al cerrar sesión', error);
      } finally {
        window.location.href = '/login';
      }
    });
  };

  return (
    <header className="mb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-gray-500">
            Hola {user?.firstName ?? 'usuario'}!{' '}
            <span className="text-gray-500">
              Tienes <span className="font-semibold text-blue-600">{pendingValidationCount}</span> facturas pendientes de validar.{' '}
              <Link href="/dashboard/revisiones" className="text-blue-600 hover:text-blue-700 underline font-medium">
                Ver
              </Link>
            </span>
          </p>
          <h1 className="text-3xl font-bold text-gray-800 mt-2">
            {user?.businessName ? `Dashboard de ${user.businessName}` : 'Dashboard' }
          </h1>
          <p className="text-gray-400 text-sm">
            {isLoading ? 'Cargando información…' : user?.email ?? 'Sin email'}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleLogout}
          disabled={isPending}
          className="self-start sm:self-auto"
        >
          {isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
      </div>
    </header>
  );
};

export default Header;
