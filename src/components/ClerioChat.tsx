import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

type ChatItem = {
  id: string;
  name: string;
  avatar: string;
  message: string;
  badgeLabel: string;
  badgeClass: string;
};

const chats: ChatItem[] = [
  {
    id: 'raul',
    name: 'Raul Asesoria',
    avatar: 'https://i.pravatar.cc/40?u=raul',
    message: 'Necesitamos los últimos trimestres subidos...',
    badgeLabel: 'Leído',
    badgeClass: 'bg-green-100 text-green-700',
  },
  {
    id: 'gemma',
    name: 'Gemma Asesoria',
    avatar: 'https://i.pravatar.cc/40?u=gemma',
    message: 'Hay unas facturas que no me han llegado todavía...',
    badgeLabel: 'Aviso',
    badgeClass: 'bg-yellow-100 text-yellow-800',
  },
  {
    id: 'laura',
    name: 'Laura Contabilidad',
    avatar: 'https://i.pravatar.cc/40?u=laura',
    message: 'He revisado los gastos de agosto, te dejo comentarios.',
    badgeLabel: 'Nuevo',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'david',
    name: 'David Fiscal',
    avatar: 'https://i.pravatar.cc/40?u=david',
    message: 'Recuerda enviarme la documentación del IVA antes del viernes.',
    badgeLabel: 'Urgente',
    badgeClass: 'bg-red-100 text-red-700',
  },
  {
    id: 'maria',
    name: 'Maria Nóminas',
    avatar: 'https://i.pravatar.cc/40?u=maria',
    message: 'Necesito confirmar las altas del nuevo personal.',
    badgeLabel: 'Pendiente',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
  {
    id: 'andres',
    name: 'Andrés Auditoría',
    avatar: 'https://i.pravatar.cc/40?u=andres',
    message: 'Te llamo mañana para repasar los ajustes del cierre.',
    badgeLabel: 'Leído',
    badgeClass: 'bg-green-100 text-green-700',
  },
];

const ClerioChat = () => {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 mt-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-gray-800">ClerioChat</h3>
        <div className="flex items-center gap-2">
          <Link
            href="/cleriochat"
            className="inline-flex items-center px-2 py-1 text-xs font-semibold text-blue-600 transition-all duration-200 rounded hover:text-blue-700 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md hover:shadow-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label="Ir a ClerioChat"
          >
            Ver
          </Link>
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{chats.length}</span>
        </div>
      </div>
      <div className="max-h-32 overflow-y-auto pr-1 space-y-3">
        {chats.map((chat) => (
          <div key={chat.id} className="flex items-start">
            <Image
              src={chat.avatar}
              alt={chat.name}
              width={40}
              height={40}
              className="rounded-full mr-3"
            />
            <div className="flex-1">
              <div className="flex items-center">
                <span className="font-semibold text-gray-800">{chat.name}</span>
                <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${chat.badgeClass}`}>
                  {chat.badgeLabel}
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-snug truncate" title={chat.message}>
                {chat.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClerioChat;
