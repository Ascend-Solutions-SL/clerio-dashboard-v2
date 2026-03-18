import React from 'react';
import { Nunito } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { useRouter } from 'next/navigation';

const nunito = Nunito({ subsets: ['latin'], weight: ['600','700','800'] });

type CleriaConversationRow = {
  id: string;
  title: string | null;
  updated_at: string | null;
};

const conversationsPreviewCache = new Map<string, CleriaConversationRow[]>();
let lastConversationsPreviewCacheKey: string | null = null;

const Integrations = () => {
  const { user, isLoading } = useDashboardSession();
  const router = useRouter();
  const [conversations, setConversations] = React.useState<CleriaConversationRow[]>(() => {
    const cacheKey = user?.id ?? lastConversationsPreviewCacheKey ?? '';
    return cacheKey ? conversationsPreviewCache.get(cacheKey) ?? [] : [];
  });
  const [isLoadingConvs, setIsLoadingConvs] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        if (!isLoading) {
          setConversations([]);
          setIsLoadingConvs(false);
          lastConversationsPreviewCacheKey = null;
        }
        return;
      }

      const cacheKey = user.id;
      const cached = conversationsPreviewCache.get(cacheKey);
      lastConversationsPreviewCacheKey = cacheKey;
      if (cached) {
        setConversations(cached);
      }

      setIsLoadingConvs(!cached);
      try {
        const res = await fetch('/api/cleria/conversations', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          if (!cached) {
            setConversations([]);
          }
          return;
        }
        const data = (await res.json().catch(() => null)) as CleriaConversationRow[] | null;
        const cleaned = (data ?? []).filter((c) => (c.title ?? '').trim().toLowerCase() !== 'nuevo chat');
        const didChange = JSON.stringify(cached ?? []) !== JSON.stringify(cleaned);
        if (didChange) {
          conversationsPreviewCache.set(cacheKey, cleaned);
          lastConversationsPreviewCacheKey = cacheKey;
          setConversations(cleaned);
        }
      } finally {
        setIsLoadingConvs(false);
      }
    };

    void load();
  }, [isLoading, user?.id]);

  const shouldShowLoading = isLoadingConvs || (isLoading && conversations.length === 0);

  const handleOpenConversation = (id: string) => {
    router.push(`/dashboard/cleria?conversationId=${encodeURIComponent(id)}`);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-full flex flex-col lg:max-h-[380px]">
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
          {shouldShowLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-slate-500">
              <div className="h-3 w-3 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
              Cargando conversaciones…
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-slate-500">No hay conversaciones aún.</div>
          ) : (
            conversations.map((conv) => {
              const title = (conv.title ?? '').trim() || 'Conversación';
              const dateLabel = conv.updated_at ? new Date(conv.updated_at).toLocaleDateString('es-ES') : null;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => handleOpenConversation(conv.id)}
                  className="w-full text-left rounded-2xl px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-100 transition"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">{title}</span>
                    {dateLabel ? <span className="text-[11px] text-slate-400 whitespace-nowrap">{dateLabel}</span> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Integrations;
