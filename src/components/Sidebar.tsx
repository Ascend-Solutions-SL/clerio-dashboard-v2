'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { Link as LinkIcon, LogOut, Settings } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { supabase } from '@/lib/supabase';

const navItems = [
  { href: '/dashboard', icon: '/sidebar/inicio_logo.png', label: 'Inicio' },
  { href: '/dashboard/ingresos', icon: '/sidebar/ingresos_logo.png', label: 'Ingresos' },
  { href: '/dashboard/gastos', icon: '/sidebar/gastos_logo.png', label: 'Gastos' },
  { href: '/dashboard/revisiones', icon: '/brand/tab_validacion/validacion_logo.png', label: 'Validación' },
  { href: '/dashboard/integraciones', icon: LinkIcon, label: 'Integraciones' },
  { href: '/dashboard/cleria', icon: '/brand/tab_cleria/cleria_logo.png', label: 'Cler IA' },
];

interface SidebarProps {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setOpen }) => {
  const pathname = usePathname();
  const { user, isLoading } = useDashboardSession();
  const [pendingValidationCount, setPendingValidationCount] = React.useState<number>(0);

  React.useEffect(() => {
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

  React.useEffect(() => {
    const handleCountUpdate = (event: CustomEvent<{ pending: number }>) => {
      setPendingValidationCount(event.detail.pending);
    };

    window.addEventListener('revisions-count-updated', handleCountUpdate as EventListener);

    return () => {
      window.removeEventListener('revisions-count-updated', handleCountUpdate as EventListener);
    };
  }, []);

  const handleLogout = () => {
    (async () => {
      try {
        const client = createSupabaseBrowserClient();
        await client.auth.signOut();
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (error) {
        console.error('Error al cerrar sesión', error);
      } finally {
        window.location.href = '/login';
      }
    })();
  };

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ''}`.trim()
    : user?.businessName ?? 'Usuario';
  const role = user?.role ?? (isLoading ? 'Cargando…' : 'Sin rol');
  const initials = (user?.initials ?? `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`).toUpperCase() || 'U';

  return (
    <aside 
      className={`bg-blue-600 text-white flex flex-col transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-20'}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="h-20 grid grid-cols-[80px_1fr] items-center">
        <div className="flex items-center justify-center">
          <div className="relative h-8 w-8">
            <Image
              src="/brand/IMAGO_BLANCO.png"
              alt="Clerio"
              fill
              sizes="32px"
              className="object-contain"
              priority
            />
          </div>
        </div>
        {isOpen ? (
          <div className="pr-6">
            <span className="font-bold text-2xl whitespace-nowrap">Clerio</span>
          </div>
        ) : null}
      </div>

      <nav className="flex-grow flex flex-col">
        {navItems.map((item) => (
          (() => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
          <Link 
            key={item.label} 
            href={item.href} 
            className="group my-1 rounded-lg relative grid grid-cols-[80px_1fr] items-center"
          >
            <div
              className={`pointer-events-none absolute inset-y-0 left-3 right-3 rounded-lg transition-colors ${
                isActive ? 'bg-blue-700' : 'bg-transparent group-hover:bg-blue-700'
              }`}
            />

            <div className="relative z-10 h-12 flex items-center justify-center">
              {typeof item.icon === 'string' ? (
                item.icon.startsWith('/sidebar/') ? (
                  <div className="relative h-5 w-5">
                    <img
                      src={item.icon}
                      alt={item.label}
                      className="h-5 w-5 object-contain"
                    />
                  </div>
                ) : (
                  <span
                    aria-label={item.label}
                    className="block h-5 w-5 bg-current"
                    style={{
                      WebkitMaskImage: `url(${item.icon})`,
                      maskImage: `url(${item.icon})`,
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskPosition: 'center',
                      WebkitMaskSize: 'contain',
                      maskSize: 'contain',
                    }}
                  />
                )
              ) : (
                <item.icon size={20} />
              )}
            </div>
            {isOpen ? (
              <span className="relative z-10 pr-4 whitespace-nowrap flex items-center gap-2">
                {item.label}
                {item.href === '/dashboard/revisiones' && pendingValidationCount > 0 ? (
                  <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold px-2 h-5 min-w-[20px]">
                    {pendingValidationCount}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="sr-only">{item.label}</span>
            )}
            {!isOpen && item.href === '/dashboard/revisiones' && pendingValidationCount > 0 ? (
              <span className="absolute right-5 top-2 z-20 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold h-4 min-w-[16px] px-1">
                {pendingValidationCount}
              </span>
            ) : null}
          </Link>
            );
          })()
        ))}
      </nav>

      <Link
        href="/dashboard/settings"
        className="group my-1 rounded-lg relative grid grid-cols-[80px_1fr] items-center"
      >
        <div className="pointer-events-none absolute inset-y-0 left-3 right-3 rounded-lg transition-colors bg-transparent group-hover:bg-blue-700" />

        <div className="relative z-10 h-12 flex items-center justify-center">
          <Settings size={20} />
        </div>
        {isOpen ? (
          <span className="relative z-10 pr-4 whitespace-nowrap">Configuración</span>
        ) : (
          <span className="sr-only">Configuración</span>
        )}
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="group my-1 rounded-lg relative grid grid-cols-[80px_1fr] items-center text-left"
      >
        <div className="pointer-events-none absolute inset-y-0 left-3 right-3 rounded-lg transition-colors bg-transparent group-hover:bg-blue-700" />

        <div className="relative z-10 h-12 flex items-center justify-center">
          <LogOut size={20} />
        </div>
        {isOpen ? (
          <span className="relative z-10 pr-4 whitespace-nowrap">Cerrar sesión</span>
        ) : (
          <span className="sr-only">Cerrar sesión</span>
        )}
      </button>

      <div className="mx-3 border-t border-white/20" />

      <div className="grid grid-cols-[80px_1fr] items-center py-4">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold border border-white/70">
            {initials}
          </div>
        </div>
        <div className={`pr-4 overflow-hidden ${isOpen ? '' : 'invisible'}`}>
          <p className="font-semibold whitespace-nowrap">
            {isLoading ? 'Cargando…' : displayName}
          </p>
          <p className="text-sm text-blue-200 whitespace-nowrap">{role}</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
