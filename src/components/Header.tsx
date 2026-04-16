"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { supabase } from '@/lib/supabase';

const userEmailCache = new Map<string, string>();

const Header = () => {
  const { user, isLoading } = useDashboardSession();
  const [pendingValidationCount, setPendingValidationCount] = useState<number>(0);
  const [cachedEmail, setCachedEmail] = useState<string | null>(() => {
    if (!user?.id) {
      return null;
    }
    return userEmailCache.get(user.id) ?? null;
  });

  useEffect(() => {
    if (!user?.id) {
      if (!isLoading) {
        setCachedEmail(null);
      }
      return;
    }

    const existing = userEmailCache.get(user.id) ?? null;
    if (existing) {
      setCachedEmail(existing);
      return;
    }

    const nextEmail = user.email?.trim() ?? '';
    if (!nextEmail) {
      return;
    }

    userEmailCache.set(user.id, nextEmail);
    setCachedEmail(nextEmail);
  }, [isLoading, user?.email, user?.id]);

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

  const emailToDisplay = cachedEmail ?? user?.email ?? '';

  return (
    <header className="mb-4">
      <div className="flex flex-col gap-3">
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
          <h1 className="mt-1 text-3xl font-bold text-gray-800">
            {user?.businessName ? `Dashboard de ${user.businessName}` : 'Dashboard' }
          </h1>
          <p className="text-gray-400 text-sm">
            {emailToDisplay || (isLoading ? 'Cargando información…' : 'Sin email')}
          </p>
        </div>
      </div>
    </header>
  );
};

export default Header;
