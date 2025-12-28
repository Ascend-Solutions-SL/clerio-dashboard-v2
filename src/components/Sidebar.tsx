'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDashboardSession } from '@/context/dashboard-session-context';
import {
  Home,
  ArrowUpCircle,
  ArrowDownCircle,
  Link as LinkIcon,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Inicio' },
  { href: '/dashboard/ingresos', icon: ArrowUpCircle, label: 'Ingresos' },
  { href: '/dashboard/gastos', icon: ArrowDownCircle, label: 'Gastos' },
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
      <div className="h-20 flex items-center px-8">
        <span className={`font-bold text-2xl transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>Clerio</span>
        <span className={`font-bold text-2xl transition-opacity duration-200 ${!isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>C</span>
      </div>

      <nav className="flex-grow flex flex-col px-4">
        {navItems.map((item) => (
          <Link 
            key={item.label} 
            href={item.href} 
            className={`flex items-center p-3 my-1 rounded-lg relative ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'bg-blue-700' : 'hover:bg-blue-700'}`}>
            <div className="flex w-6 items-center justify-center">
              {typeof item.icon === 'string' ? (
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
              ) : (
                <item.icon size={20} />
              )}
            </div>
            <span className={`ml-3 whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 flex items-center">
        <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className={`ml-3 overflow-hidden transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
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
