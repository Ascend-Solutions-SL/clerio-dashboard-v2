'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { Link as LinkIcon } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: '/sidebar/inicio_logo.png', label: 'Inicio' },
  { href: '/dashboard/ingresos', icon: '/sidebar/ingresos_logo.png', label: 'Ingresos' },
  { href: '/dashboard/gastos', icon: '/sidebar/gastos_logo.png', label: 'Gastos' },
  { href: '/dashboard/integraciones', icon: LinkIcon, label: 'Integraciones' },
  { href: '/dashboard/cleria', icon: '/brand/cleria_logo.png', label: 'Cler IA' },
];

interface SidebarProps {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setOpen }) => {
  const pathname = usePathname();
  const { user, isLoading } = useDashboardSession();

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
              <span className="relative z-10 pr-4 whitespace-nowrap">{item.label}</span>
            ) : (
              <span className="sr-only">{item.label}</span>
            )}
          </Link>
            );
          })()
        ))}
      </nav>

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
