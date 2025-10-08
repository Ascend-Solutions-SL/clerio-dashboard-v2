'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ArrowUpCircle,
  ArrowDownCircle,
  Link as LinkIcon,
  MessageSquare,
} from 'lucide-react';

const navItems = [
  { href: '/', icon: Home, label: 'Inicio' },
  { href: '/ingresos', icon: ArrowUpCircle, label: 'Ingresos' },
  { href: '/gastos', icon: ArrowDownCircle, label: 'Gastos' },
  { href: '#', icon: LinkIcon, label: 'Integraciones' },
  { href: '#', icon: MessageSquare, label: 'ClerioChat', badge: 2 },
];

interface SidebarProps {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setOpen }) => {
  const pathname = usePathname();

  return (
    <aside 
      className={`bg-blue-600 text-white flex flex-col transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-20'}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="h-20 flex items-center px-6">
        <span className={`font-bold text-2xl transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>Clerio</span>
        <span className={`font-bold text-2xl transition-opacity duration-200 ${!isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>C</span>
      </div>

      <nav className="flex-grow flex flex-col px-4">
        {navItems.map((item) => (
          <Link 
            key={item.label} 
            href={item.href} 
            className={`flex items-center p-3 my-1 rounded-lg relative ${pathname === item.href ? 'bg-blue-700' : 'hover:bg-blue-700'}`}>
            <div className="w-6">
              <item.icon size={20} />
            </div>
            <span className={`ml-3 whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
            {item.badge && (
              <span className={`ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                {item.badge}
              </span>
            )}
            {!isOpen && item.badge && (
              <span className="absolute top-1 right-1 bg-red-500 w-2 h-2 rounded-full"></span>
            )}
          </Link>
        ))}
      </nav>

      <div className="p-4 flex items-center">
        <img
          src="https://i.pravatar.cc/40?u=helena"
          alt="User Avatar"
          className="w-10 h-10 rounded-full flex-shrink-0"
        />
        <div className={`ml-3 overflow-hidden transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
          <p className="font-semibold whitespace-nowrap">Helena Albir</p>
          <p className="text-sm text-blue-200 whitespace-nowrap">helenaalbir@gmail.com</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
