'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { BarChart3, FileText, LayoutDashboard, Logs, LogOut, Plug } from 'lucide-react';

const navItems = [
  { href: '/master', label: 'Inicio', icon: LayoutDashboard },
  { href: '/master/integraciones', label: 'Integraciones', icon: Plug },
  { href: '/master/solicitudes', label: 'Solicitudes', icon: FileText },
  { href: '/master/analisis', label: 'Analisis', icon: BarChart3 },
  { href: '/master/logs', label: 'Logs', icon: Logs },
] as const;

export default function MasterSidebar() {
  const pathname = usePathname();
  const { user, isLoading } = useDashboardSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const role = user?.role ?? (isLoading ? 'Cargando…' : 'Sin rol');
  const initials = useMemo(
    () => (user?.initials ?? `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`).toUpperCase() || 'U',
    [user?.firstName, user?.initials, user?.lastName]
  );

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      window.location.href = '/login';
    }
  }, [isSigningOut]);

  return (
    <aside className="bg-slate-900 text-white w-64 flex flex-col">
      <div className="h-20 flex items-center px-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center">
            <Image
              src="/brand/master_section/IMAGO_BLANCO.png"
              alt="Clerio"
              width={32}
              height={32}
              className="h-[32px] w-[32px] object-contain"
              priority
            />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Master</div>
            <div className="text-xs text-white/60">Clerio</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/master' ? pathname === '/master' : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isActive ? 'bg-white/10' : 'hover:bg-white/10'
              }`}
            >
              <Icon size={18} className="opacity-90" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10">
        <div className="p-3">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-60"
          >
            <LogOut size={18} className="opacity-90" />
            <span>{isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
          </button>
        </div>

        <div className="px-3 pb-4">
          <div className="flex items-center gap-3 rounded-xl px-3 py-3 bg-white/5">
            <div className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center font-semibold border border-white/20">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{user?.email ?? '—'}</p>
              <p className="text-xs text-white/60 whitespace-nowrap overflow-hidden text-ellipsis">{role}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
