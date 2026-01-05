import React from 'react';
import { Nunito } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import { CLERIA_CHAT_HISTORY } from '@/lib/cleria-chat-history';

const nunito = Nunito({ subsets: ['latin'], weight: ['600','700','800'] });

const Integrations = () => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-200">
        <h3 className={`text-gray-800 text-base font-semibold ${nunito.className} flex items-center gap-2`}>
          <span className="relative h-5 w-5">
            <Image
              src="/brand/tab_cleria/cleria_color_logo.png"
              alt="Cler IA"
              fill
              sizes="20px"
              className="object-contain"
            />
          </span>
          ClerIA
        </h3>
        <Link
          href="/dashboard/cleria"
          className="inline-flex items-center px-1 py-0.5 text-[10px] font-medium text-blue-600 transition-all duration-200 rounded hover:text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
        >
          Abrir
        </Link>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        <div className="space-y-1">
          {CLERIA_CHAT_HISTORY.map((title) => (
            <Link
              key={title}
              href="/dashboard/cleria"
              className="w-full block text-left rounded-2xl px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-100 transition"
            >
              <span className="block truncate">{title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Integrations;
