"use client";

import Cleria from '@/components/Cleria';
import { Edit3, Search, MoreHorizontal, Pencil, Trash2, Sidebar, ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { useSearchParams } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type CleriaConversationRow = {
  id: string;
  title: string | null;
  updated_at: string | null;
};

type VisualScaleLevel = 'muy_grande' | 'grande' | 'normal' | 'pequeno' | 'muy_pequeno';

const VISUAL_SCALE_KEY = 'dashboard-visual-scale-level';

const MAIN_SCALE_CLASS_BY_LEVEL: Record<VisualScaleLevel, string> = {
  muy_grande: '[zoom:0.98]',
  grande: '[zoom:0.94]',
  normal: '[zoom:0.90]',
  pequeno: '[zoom:0.86]',
  muy_pequeno: '[zoom:0.82]',
};

const SIDEBAR_SCALE_CLASS_BY_LEVEL: Record<VisualScaleLevel, string> = {
  muy_grande: '[zoom:0.92]',
  grande: '[zoom:0.88]',
  normal: '[zoom:0.84]',
  pequeno: '[zoom:0.80]',
  muy_pequeno: '[zoom:0.76]',
};

function ClerIAPageClient() {
  const { user, isLoading } = useDashboardSession();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = React.useState<CleriaConversationRow[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = React.useState(false);
  const didBootstrapRef = React.useRef(false);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const renameInputRef = React.useRef<HTMLInputElement | null>(null);
  const renameContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [isConversationsSidebarCollapsed, setIsConversationsSidebarCollapsed] = React.useState(false);
  const [visualScaleLevel, setVisualScaleLevel] = React.useState<VisualScaleLevel>('normal');

  const empresaId = user?.empresaId ?? null;

  const loadConversations = React.useCallback(async () => {
    if (!user?.id || empresaId == null) {
      setConversations([]);
      setActiveConversationId(null);
      return;
    }

    const res = await fetch('/api/cleria/conversations', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      setConversations([]);
      return;
    }

    const data = (await res.json().catch(() => null)) as CleriaConversationRow[] | null;
    setConversations(data ?? []);
  }, [empresaId, user?.id]);

  const createConversation = React.useCallback(async () => {
    if (!user?.id || empresaId == null) {
      return null;
    }

    const createRes = await fetch('/api/cleria/conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        user_uid: user.id,
        empresa_id: empresaId,
      }),
    });

    if (!createRes.ok) {
      return null;
    }

    const created = (await createRes.json().catch(() => null)) as { id?: string } | null;
    const createdId = String(created?.id ?? '').trim();
    return createdId || null;
  }, [empresaId, user?.id]);

  const ensureDefaultConversation = React.useCallback(async () => {
    if (!user?.id || empresaId == null) {
      return;
    }

    if (didBootstrapRef.current) {
      return;
    }

    didBootstrapRef.current = true;

    setIsBootstrapping(true);

    try {
      const listRes = await fetch('/api/cleria/conversations', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const convRows = listRes.ok ? ((await listRes.json().catch(() => null)) as CleriaConversationRow[] | null) : null;

      const rows = convRows ?? [];
      if (rows.length > 0) {
        const latest = rows[0]!;
        const latestTitle = (latest.title ?? '').trim() || 'Nuevo Chat';

        const latestConversationRes = await fetch(`/api/cleria/conversation/${encodeURIComponent(latest.id)}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        const latestMessages = latestConversationRes.ok ? ((await latestConversationRes.json().catch(() => null)) as unknown[] | null) : null;
        const latestIsEmpty = (latestMessages?.length ?? 0) === 0;

        if (latestTitle === 'Nuevo Chat' && latestIsEmpty) {
          setConversations(rows);
          setActiveConversationId((prev) => prev ?? latest.id);
          return;
        }

        const updatedAtMs = latest.updated_at ? new Date(latest.updated_at).getTime() : NaN;
        const oneMinuteMs = 1 * 60 * 1000;
        const isStale = Number.isFinite(updatedAtMs) ? Date.now() - updatedAtMs > oneMinuteMs : false;

        if (!latestIsEmpty && isStale) {
          const createdId = await createConversation();
          if (!createdId) {
            setConversations(rows);
            setActiveConversationId((prev) => prev ?? latest.id);
            return;
          }

          setActiveConversationId(createdId);
          await loadConversations();
          return;
        }

        setConversations(rows);
        setActiveConversationId((prev) => prev ?? latest.id);
        return;
      }

      const createdId = await createConversation();
      if (!createdId) {
        await loadConversations();
        return;
      }

      setActiveConversationId(createdId);
      await loadConversations();
    } finally {
      setIsBootstrapping(false);
    }
  }, [createConversation, empresaId, loadConversations, user?.id]);

  // Sync active conversation with URL param when present
  React.useEffect(() => {
    const idFromUrl = searchParams.get('conversationId');
    if (idFromUrl) {
      setActiveConversationId(idFromUrl);
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (!renamingId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renamingId]);

  const startRenaming = React.useCallback(
    (conv: CleriaConversationRow) => {
      setRenamingId(conv.id);
      setRenameDraft((conv.title ?? '').trim() || 'Nuevo Chat');
    },
    [setRenamingId]
  );

  const cancelRenaming = React.useCallback(() => {
    setRenamingId(null);
    setRenameDraft('');
  }, []);

  const saveRename = React.useCallback(async () => {
    if (!renamingId || !user?.id) {
      cancelRenaming();
      return;
    }

    const nextTitle = renameDraft.trim().slice(0, 60);
    if (!nextTitle) {
      cancelRenaming();
      return;
    }

    const res = await fetch(`/api/cleria/conversation/${encodeURIComponent(renamingId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ title: nextTitle }),
    });

    if (!res.ok) {
      cancelRenaming();
      return;
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === renamingId ? { ...c, title: nextTitle, updated_at: new Date().toISOString() } : c))
    );

    cancelRenaming();
  }, [cancelRenaming, renameDraft, renamingId, user?.id]);

  React.useEffect(() => {
    if (!renamingId) return;

    const margin = 10;
    const onPointerDown = (event: PointerEvent) => {
      const container = renameContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;
      const insideWithMargin =
        x >= rect.left - margin && x <= rect.right + margin && y >= rect.top - margin && y <= rect.bottom + margin;

      if (insideWithMargin) {
        return;
      }

      void saveRename();
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [renamingId, saveRename]);

  const handleNewChat = React.useCallback(async () => {
    if (!user?.id || empresaId == null) {
      return;
    }

    const res = await fetch('/api/cleria/conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        user_uid: user.id,
        empresa_id: empresaId,
      }),
    });

    if (!res.ok) {
      return;
    }

    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    const id = String(json?.id ?? '').trim();
    if (!id) {
      return;
    }

    setActiveConversationId(id);
    await loadConversations();
  }, [empresaId, loadConversations, user?.id]);

  const confirmDelete = React.useCallback((id: string) => {
    setDeleteTargetId(id);
  }, []);

  const handleDeleteConfirmed = React.useCallback(async () => {
    if (!deleteTargetId) return;

    const targetId = deleteTargetId;
    const remaining = conversations.filter((c) => c.id !== targetId);
    const res = await fetch(`/api/cleria/conversation/${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      setDeleteTargetId(null);
      return;
    }

    setDeleteTargetId(null);

    setConversations(remaining);

    if (activeConversationId === targetId) {
      const nextMostRecent = remaining[0] ?? null;
      if (nextMostRecent?.id) {
        setActiveConversationId(nextMostRecent.id);
        return;
      }
      await handleNewChat();
    }
  }, [activeConversationId, conversations, deleteTargetId, handleNewChat]);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    void ensureDefaultConversation();
  }, [ensureDefaultConversation, isLoading]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const applySavedScale = () => {
      const raw = window.localStorage.getItem(VISUAL_SCALE_KEY) as VisualScaleLevel | null;
      if (!raw) {
        setVisualScaleLevel('normal');
        return;
      }
      if (raw in MAIN_SCALE_CLASS_BY_LEVEL) {
        setVisualScaleLevel(raw);
      } else {
        setVisualScaleLevel('normal');
      }
    };

    const onScaleChanged = () => applySavedScale();
    window.addEventListener('dashboard-visual-scale-changed', onScaleChanged);
    applySavedScale();

    return () => {
      window.removeEventListener('dashboard-visual-scale-changed', onScaleChanged);
    };
  }, []);

  const mainScaleClass = MAIN_SCALE_CLASS_BY_LEVEL[visualScaleLevel] ?? MAIN_SCALE_CLASS_BY_LEVEL.normal;
  const sidebarScaleClass = SIDEBAR_SCALE_CLASS_BY_LEVEL[visualScaleLevel] ?? SIDEBAR_SCALE_CLASS_BY_LEVEL.normal;

  return (
  <>
    <div className="h-full w-full bg-white">
      <div
        className={`relative grid h-full grid-cols-1 overflow-hidden transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isConversationsSidebarCollapsed ? 'lg:grid-cols-[40px_minmax(0,1fr)]' : 'lg:grid-cols-[220px_minmax(0,1fr)]'
        }`}
      >
        <aside className="relative hidden overflow-hidden border-r border-gray-200 bg-gray-50 text-gray-900 lg:flex lg:flex-col">
          <div className={`h-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${sidebarScaleClass}`}>
          <div className="relative px-0 pt-3 pb-3 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
            <button
              type="button"
              onClick={() => setIsConversationsSidebarCollapsed((prev) => !prev)}
              className={`absolute top-3 z-10 inline-flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-xl text-gray-700 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-gray-100 ${
                isConversationsSidebarCollapsed ? 'left-5' : 'left-[calc(100%-20px)]'
              }`}
              aria-label={isConversationsSidebarCollapsed ? 'Desplegar sidebar de conversaciones' : 'Plegar sidebar de conversaciones'}
            >
              <Sidebar className="h-4.5 w-4.5" />
            </button>
            <div className="space-y-1 pt-9">
            <button
              type="button"
              className="grid w-full grid-cols-[40px_minmax(0,1fr)] items-center rounded-xl border border-transparent px-0 py-0.5 text-[13px] font-semibold text-gray-800 transition hover:bg-gray-100"
              onClick={() => void handleNewChat()}
              disabled={empresaId == null || isBootstrapping}
            >
              <span className="flex h-7 w-full items-center justify-center">
                <Edit3 className="h-4 w-4 text-gray-700" />
              </span>
              <span
                className={`overflow-hidden whitespace-nowrap text-left transition-all duration-300 ${
                  isConversationsSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[180px] opacity-100'
                }`}
              >
                Nuevo chat
              </span>
            </button>

            <button
              type="button"
              className="grid w-full grid-cols-[40px_minmax(0,1fr)] items-center rounded-xl border border-transparent px-0 py-0.5 text-[13px] font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              <span className="flex h-7 w-full items-center justify-center">
                <Search className="h-4 w-4 text-gray-700" />
              </span>
              <span
                className={`overflow-hidden whitespace-nowrap text-left transition-all duration-300 ${
                  isConversationsSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[180px] opacity-100'
                }`}
              >
                Buscar chats
              </span>
            </button>
            </div>
          </div>

          <div
            className={`overflow-hidden px-3 pb-2 transition-all duration-300 ${
              isConversationsSidebarCollapsed ? 'max-h-0 opacity-0 pointer-events-none pb-0' : 'max-h-16 opacity-100'
            }`}
          >
            <p className="text-[11px] font-semibold tracking-wide text-gray-500">Tus chats</p>
          </div>

          <div
            className={`flex-1 overflow-hidden transition-all duration-300 ${
              isConversationsSidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
          <div className="h-full overflow-y-auto px-1.5 pb-3">
            <div className="space-y-1">
              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const title = (conv.title ?? '').trim() || 'Nuevo Chat';
                const isRenamingThis = renamingId === conv.id;
                return (
                  <div
                    key={conv.id}
                    className={`group w-full flex items-center gap-2 rounded-xl border border-transparent px-3 py-1.5 text-[13px] transition ${
                      isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (renamingId) return;
                        setActiveConversationId(conv.id);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      {isRenamingThis ? (
                        <div
                          ref={renameContainerRef}
                          className="w-full"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <input
                            ref={renameInputRef}
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void saveRename();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelRenaming();
                              }
                            }}
                            className="w-full rounded-md bg-white px-2 py-1 text-[13px] text-gray-900 shadow-sm ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-gray-300"
                          />
                        </div>
                      ) : (
                        <span className="block truncate">{title}</span>
                      )}
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={`transition-opacity text-gray-500 hover:text-gray-700 ${
                            isRenamingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Opciones"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            startRenaming(conv);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Renombrar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            confirmDelete(conv.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
          </div>
        </aside>

        <button
          type="button"
          onClick={() => setIsConversationsSidebarCollapsed((prev) => !prev)}
          className={`absolute top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 p-1 text-gray-500 shadow-sm backdrop-blur-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-gray-700 lg:inline-flex ${
            isConversationsSidebarCollapsed ? 'left-[40px] -translate-x-1/2' : 'left-[220px] -translate-x-1/2'
          }`}
          aria-label={isConversationsSidebarCollapsed ? 'Desplegar conversaciones' : 'Plegar conversaciones'}
        >
          {isConversationsSidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

          <main className="h-full overflow-hidden p-6">
            <div className={`h-full w-full ${mainScaleClass}`}>
              <Cleria conversationId={activeConversationId} onConversationTitleMaybeUpdated={loadConversations} />
            </div>
          </main>
        </div>
      </div>

      <Dialog open={deleteTargetId != null} onOpenChange={(open) => (!open ? setDeleteTargetId(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar conversación</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm"
              onClick={() => setDeleteTargetId(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-md bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
              onClick={() => void handleDeleteConfirmed()}
            >
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ClerIAPage() {
  return (
    <React.Suspense fallback={<div className="h-full w-full bg-white" />}>
      <ClerIAPageClient />
    </React.Suspense>
  );
}
