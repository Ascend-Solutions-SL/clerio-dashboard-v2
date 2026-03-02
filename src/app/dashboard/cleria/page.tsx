"use client";

import Cleria from '@/components/Cleria';
import { Edit3, Search, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import React from 'react';
import { useDashboardSession } from '@/context/dashboard-session-context';
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

export default function ClerIAPage() {
  const { user, isLoading } = useDashboardSession();
  const [conversations, setConversations] = React.useState<CleriaConversationRow[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = React.useState(false);
  const didBootstrapRef = React.useRef(false);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const renameInputRef = React.useRef<HTMLInputElement | null>(null);
  const renameContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

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
        setConversations(rows);
        setActiveConversationId((prev) => prev ?? rows[0]!.id);
        return;
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
        await loadConversations();
        return;
      }

      const created = (await createRes.json().catch(() => null)) as { id?: string } | null;
      const createdId = String(created?.id ?? '').trim();
      if (!createdId) {
        await loadConversations();
        return;
      }

      setActiveConversationId(createdId);
      await loadConversations();
    } finally {
      setIsBootstrapping(false);
    }
  }, [empresaId, loadConversations, user?.id]);

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

  return (
  <>
    <div className="h-full w-full bg-white">
      <div className="h-full overflow-hidden grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:flex flex-col bg-gray-50 text-gray-900 overflow-hidden border-r border-gray-200">
          <div className="px-4 pt-4 pb-3">
            <button
              type="button"
              className="w-full flex items-center gap-2 rounded-2xl hover:bg-gray-100 transition px-3 py-2 text-[13px] font-semibold text-gray-800"
              onClick={() => void handleNewChat()}
              disabled={empresaId == null || isBootstrapping}
            >
              <Edit3 className="h-4 w-4 text-gray-700" />
              Nuevo chat
            </button>

            <button
              type="button"
              className="mt-1 w-full flex items-center gap-2 rounded-2xl hover:bg-gray-100 transition px-3 py-2 text-[13px] font-semibold text-gray-700"
            >
              <Search className="h-4 w-4 text-gray-700" />
              Buscar chats
            </button>
          </div>

          <div className="px-4 pb-2">
            <p className="text-[11px] font-semibold tracking-wide text-gray-500">Tus chats</p>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <div className="space-y-1">
              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const title = (conv.title ?? '').trim() || 'Nuevo Chat';
                const isRenamingThis = renamingId === conv.id;
                return (
                  <div
                    key={conv.id}
                    className={`group w-full flex items-center gap-2 rounded-2xl px-3 py-2 text-[13px] transition ${
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
        </aside>

          <main className="h-full overflow-hidden p-6">
            <Cleria conversationId={activeConversationId} onConversationTitleMaybeUpdated={loadConversations} />
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
