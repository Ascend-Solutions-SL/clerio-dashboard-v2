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
  const [isSigningOut, setIsSigningOut] = React.useState(false);

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
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    (async () => {
      try {
        const client = createSupabaseBrowserClient();
        await Promise.allSettled([
          client.auth.signOut(),
          fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' }),
        ]);
      } catch (error) {
        console.error('Error al cerrar sesión', error);
      } finally {
        window.location.replace('/login');
      }
    })();
  };

  const firstName = user?.firstName?.trim() ?? '';
  const firstSurname = user?.lastName?.trim()?.split(' ')?.[0] ?? '';
  const displayName = firstName
    ? `${firstName} ${firstSurname}`.trim()
    : user?.businessName ?? 'Usuario';
  const role = user?.role ?? (isLoading ? 'Cargando…' : 'Sin rol');
  const initials = (user?.initials ?? `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`).toUpperCase() || 'U';

  return (
    <aside 
      className={`bg-blue-600 text-white flex flex-col transition-all duration-300 ease-in-out ${isOpen ? 'w-48' : 'w-[68px]'}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="grid h-[76px] grid-cols-[36px_minmax(0,1fr)] items-center px-4 pt-2 pb-1">
        <div className="flex h-12 items-center justify-center">
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
        <div className={`flex h-12 items-center overflow-hidden pl-2 pr-2.5 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {isOpen ? (
            <span className="font-bold text-2xl whitespace-nowrap">Clerio</span>
          ) : null}
        </div>
      </div>

      <nav className="flex-grow flex flex-col pt-0">
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
            className="group relative mx-0 my-0.5 grid grid-cols-[36px_minmax(0,1fr)] items-center rounded-none px-4"
          >
            <div
              className={`pointer-events-none absolute inset-0 transition-colors ${
                isActive ? 'bg-blue-700' : 'bg-transparent group-hover:bg-blue-700'
              }`}
            />

            <div className="relative z-10 flex h-11 items-center justify-center">
              {typeof item.icon === 'string' ? (
                item.icon.startsWith('/sidebar/') ? (
                  <div className="relative h-5 w-5">
                    <Image
                      src={item.icon}
                      alt={item.label}
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] object-contain"
                    />
                  </div>
                ) : (
                  <span
                    aria-label={item.label}
                    className="block h-[18px] w-[18px] bg-current"
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
                <item.icon size={18} />
              )}
            </div>
            <span
              className={`relative z-10 flex items-center whitespace-nowrap pr-2.5 transition-opacity duration-200 ${
                isOpen
                  ? 'opacity-100 gap-2 pl-2 text-sm'
                  : 'opacity-0 pointer-events-none gap-0 pl-0'
              }`}
            >
              {isOpen ? (
                <>
                {item.label}
                {item.href === '/dashboard/revisiones' && pendingValidationCount > 0 ? (
                  <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold px-2 h-5 min-w-[20px]">
                    {pendingValidationCount}
                  </span>
                ) : null}
                </>
              ) : null}
            </span>
            {!isOpen ? <span className="sr-only">{item.label}</span> : null}
            {!isOpen && item.href === '/dashboard/revisiones' && pendingValidationCount > 0 ? (
              <span className="absolute right-[14px] top-2 z-20 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold h-4 min-w-[16px] px-1">
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
        className="group relative mx-0 my-1 grid grid-cols-[36px_minmax(0,1fr)] items-center rounded-none px-4"
      >
        <div className="pointer-events-none absolute inset-0 transition-colors bg-transparent group-hover:bg-blue-700" />

        <div className="relative z-10 flex h-11 items-center justify-center">
          <Settings size={18} />
        </div>
        <span
          className={`relative z-10 whitespace-nowrap pr-2.5 transition-opacity duration-200 ${
            isOpen ? 'opacity-100 text-sm' : 'opacity-0 pointer-events-none'
          }`}
        >
          {isOpen ? 'Configuración' : null}
        </span>
        {!isOpen ? <span className="sr-only">Configuración</span> : null}
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isSigningOut}
        className="group relative mx-0 my-1 grid grid-cols-[36px_minmax(0,1fr)] items-center rounded-none px-4 text-left"
      >
        <div className="pointer-events-none absolute inset-0 transition-colors bg-transparent group-hover:bg-blue-700" />

        <div className="relative z-10 flex h-11 items-center justify-center">
          <LogOut size={18} />
        </div>
        <span
          className={`relative z-10 whitespace-nowrap pr-2.5 transition-opacity duration-200 ${
            isOpen ? 'opacity-100 text-sm' : 'opacity-0 pointer-events-none'
          }`}
        >
          {isOpen ? (isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión') : null}
        </span>
        {!isOpen ? <span className="sr-only">{isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</span> : null}
      </button>

      <div className="mx-4 border-t border-white/20" />

      <div className="grid grid-cols-[36px_minmax(0,1fr)] items-center px-4 py-2.5">
        <div className="flex h-11 items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold border border-white/70">
            {initials}
          </div>
        </div>
        <div className={`overflow-hidden pr-2.5 transition-opacity duration-200 ${isOpen ? 'opacity-100 pl-3 text-sm' : 'opacity-0 pointer-events-none'}`}>
          {isOpen ? (
            <>
              <p className="font-semibold whitespace-nowrap text-sm">
                {isLoading ? 'Cargando…' : displayName}
              </p>
              <p className="text-xs text-blue-200 whitespace-nowrap">{role}</p>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
