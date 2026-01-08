"use client";

import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const Header = () => {
  const { user, isLoading } = useDashboardSession();
  const [isPending, startTransition] = useTransition();

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
            Hola {user?.firstName ?? 'usuario'}!
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
