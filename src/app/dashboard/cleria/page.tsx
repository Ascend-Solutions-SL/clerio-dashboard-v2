"use client";

import Cleria from '@/components/Cleria';
import { Edit3, Search, MoreHorizontal, Pencil, Trash2, Sidebar, ChevronLeft, ChevronRight, X, Circle } from 'lucide-react';
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

const conversationsCacheByUser = new Map<string, CleriaConversationRow[]>();
const activeConversationCacheByUser = new Map<string, string | null>();

const VISUAL_SCALE_KEY = 'dashboard-visual-scale-level';
const CLERIA_INITIAL_ASSISTANT_MESSAGE = 'Hola, soy Cler IA y estoy aquí para ayudarte con los datos financieros de tu empresa.';

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

function SidebarSkeleton() {
  return (
    <div className="space-y-1 px-1.5 pb-3 pt-1">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div key={`sidebar-skeleton-${idx}`} className="rounded-xl border border-transparent px-3 py-1.5">
          <div className="h-4 w-full animate-pulse rounded-md bg-gray-200/80" />
        </div>
      ))}
    </div>
  );
}

function SearchDialogSkeleton() {
  return (
    <div className="space-y-3 px-1 py-1">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={`search-skeleton-${idx}`} className="rounded-md px-2 py-1.5">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-white/15" />
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-28 animate-pulse rounded bg-white/15" />
              <div className="h-2.5 w-48 animate-pulse rounded bg-white/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClerIAPageClient() {
  const { user, isLoading } = useDashboardSession();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = React.useState<CleriaConversationRow[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const renameInputRef = React.useRef<HTMLInputElement | null>(null);
  const renameContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [isConversationsSidebarCollapsed, setIsConversationsSidebarCollapsed] = React.useState(false);
  const [visualScaleLevel, setVisualScaleLevel] = React.useState<VisualScaleLevel>('normal');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [searchDraft, setSearchDraft] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const sidebarScrollRef = React.useRef<HTMLDivElement | null>(null);
  const sidebarScrollIdleTimeoutRef = React.useRef<number | null>(null);
  const sidebarScrollHintDelayTimeoutRef = React.useRef<number | null>(null);
  const [isSidebarScrollActive, setIsSidebarScrollActive] = React.useState(false);
  const [showSidebarScrollHint, setShowSidebarScrollHint] = React.useState(false);
  const layoutContainerRef = React.useRef<HTMLDivElement | null>(null);
  const hasAutoCollapsedForNarrowRef = React.useRef(false);
  const hasInitializedConversationsRef = React.useRef(false);

  const empresaId = user?.empresaId ?? null;

  const areConversationRowsEqual = React.useCallback((a: CleriaConversationRow[], b: CleriaConversationRow[]) => {
    if (a.length !== b.length) {
      return false;
    }

    for (let index = 0; index < a.length; index += 1) {
      const current = a[index];
      const next = b[index];
      if (current.id !== next.id || current.title !== next.title || current.updated_at !== next.updated_at) {
        return false;
      }
    }

    return true;
  }, []);

  const loadConversations = React.useCallback(async (): Promise<CleriaConversationRow[]> => {
    if (!user?.id || empresaId == null) {
      setConversations([]);
      setActiveConversationId(null);
      return [];
    }

    const res = await fetch('/api/cleria/conversations', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return conversations;
    }

    const data = (await res.json().catch(() => null)) as CleriaConversationRow[] | null;
    const rows = data ?? [];
    conversationsCacheByUser.set(user.id, rows);
    setConversations((prev) => (areConversationRowsEqual(prev, rows) ? prev : rows));
    return rows;
  }, [areConversationRowsEqual, conversations, empresaId, user?.id]);

  const ensureDefaultConversation = React.useCallback(async () => {
    if (!user?.id || empresaId == null) {
      setIsBootstrapping(false);
      return;
    }

    const shouldShowBootstrapping = conversations.length === 0;
    if (shouldShowBootstrapping) {
      setIsBootstrapping(true);
    }

    try {
      const rows = await loadConversations();
      const idFromUrl = searchParams.get('conversationId');
      const idFromUrlExists = idFromUrl ? rows.some((row) => row.id === idFromUrl) : false;

      setActiveConversationId((prev) => {
        const resolved = (() => {
          if (prev && rows.some((row) => row.id === prev)) {
            return prev;
          }
          if (idFromUrl && idFromUrlExists) {
            return idFromUrl;
          }
          return rows[0]?.id ?? null;
        })();

        if (user?.id) {
          activeConversationCacheByUser.set(user.id, resolved);
        }

        return resolved;
      });
    } finally {
      if (shouldShowBootstrapping) {
        setIsBootstrapping(false);
      }
    }
  }, [conversations.length, empresaId, loadConversations, searchParams, user?.id]);

  // Sync active conversation with URL param when present and valid
  React.useEffect(() => {
    const idFromUrl = searchParams.get('conversationId');
    if (idFromUrl && conversations.some((row) => row.id === idFromUrl)) {
      setActiveConversationId(idFromUrl);
    }
  }, [conversations, searchParams]);

  React.useEffect(() => {
    if (!user?.id) {
      return;
    }
    activeConversationCacheByUser.set(user.id, activeConversationId);
  }, [activeConversationId, user?.id]);

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
    setActiveConversationId(null);
    if (user?.id) {
      activeConversationCacheByUser.set(user.id, null);
    }
    setRenamingId(null);
    setRenameDraft('');
  }, [user?.id]);

  const ensureConversationForFirstMessage = React.useCallback(async (): Promise<string | null> => {
    if (activeConversationId) {
      return activeConversationId;
    }

    const createdId = await (async () => {
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
          initial_assistant_message: CLERIA_INITIAL_ASSISTANT_MESSAGE,
        }),
      });

      if (!createRes.ok) {
        return null;
      }

      const created = (await createRes.json().catch(() => null)) as { id?: string } | null;
      const id = String(created?.id ?? '').trim();
      return id || null;
    })();

    if (!createdId) {
      return null;
    }

    const now = new Date().toISOString();
    setConversations((prev) => {
      const next = prev.filter((row) => row.id !== createdId);
      const rows = [{ id: createdId, title: 'Nuevo Chat', updated_at: now }, ...next];
      if (user?.id) {
        conversationsCacheByUser.set(user.id, rows);
      }
      return rows;
    });
    setActiveConversationId(createdId);
    if (user?.id) {
      activeConversationCacheByUser.set(user.id, createdId);
    }
    return createdId;
  }, [activeConversationId, empresaId, user?.id]);

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
      setActiveConversationId(null);
    }
  }, [activeConversationId, conversations, deleteTargetId]);

  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user?.id || empresaId == null) {
      setIsBootstrapping(false);
      hasInitializedConversationsRef.current = false;
      return;
    }

    if (!hasInitializedConversationsRef.current) {
      hasInitializedConversationsRef.current = true;
      const cachedRows = conversationsCacheByUser.get(user.id) ?? [];
      const cachedActiveId = activeConversationCacheByUser.get(user.id) ?? null;

      if (cachedRows.length > 0) {
        setConversations((prev) => (areConversationRowsEqual(prev, cachedRows) ? prev : cachedRows));
        setActiveConversationId((prev) => {
          if (prev && cachedRows.some((row) => row.id === prev)) {
            return prev;
          }
          if (cachedActiveId && cachedRows.some((row) => row.id === cachedActiveId)) {
            return cachedActiveId;
          }
          return cachedRows[0]?.id ?? null;
        });
        setIsBootstrapping(false);
        void loadConversations();
        return;
      }

      void ensureDefaultConversation();
      return;
    }

    void loadConversations();
  }, [empresaId, ensureDefaultConversation, isLoading, loadConversations, user?.id]);

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
  const prefetchConversationIds = React.useMemo(
    () => conversations.slice(0, 5).map((conversation) => conversation.id),
    [conversations]
  );

  const sortedConversations = React.useMemo(() => {
    return [...conversations].sort((a, b) => {
      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [conversations]);

  const filteredConversations = React.useMemo(() => {
    const query = searchDraft.trim().toLowerCase();
    if (!query) {
      return sortedConversations;
    }

    return sortedConversations.filter((conversation) => {
      const title = (conversation.title ?? '').trim().toLowerCase();
      return title.includes(query);
    });
  }, [searchDraft, sortedConversations]);

  const groupedSearchResults = React.useMemo(() => {
    type GroupLabel = 'Hoy' | 'Ayer' | '7 días anteriores' | 'Anteriores';
    const groups: Record<GroupLabel, CleriaConversationRow[]> = {
      Hoy: [],
      Ayer: [],
      '7 días anteriores': [],
      Anteriores: [],
    };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    for (const conversation of filteredConversations) {
      const updatedAt = conversation.updated_at ? new Date(conversation.updated_at) : null;
      if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
        groups.Anteriores.push(conversation);
        continue;
      }

      const updatedStart = new Date(updatedAt.getFullYear(), updatedAt.getMonth(), updatedAt.getDate()).getTime();
      const diffDays = Math.floor((todayStart - updatedStart) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        groups.Hoy.push(conversation);
        continue;
      }

      if (diffDays === 1) {
        groups.Ayer.push(conversation);
        continue;
      }

      if (diffDays <= 7) {
        groups['7 días anteriores'].push(conversation);
        continue;
      }

      groups.Anteriores.push(conversation);
    }

    const order: GroupLabel[] = ['Hoy', 'Ayer', '7 días anteriores', 'Anteriores'];
    return order
      .map((label) => ({ label, items: groups[label] }))
      .filter((section) => section.items.length > 0);
  }, [filteredConversations]);

  React.useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const id = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(id);
  }, [isSearchOpen]);

  const openSearch = React.useCallback(() => {
    setSearchDraft('');
    setIsSearchOpen(true);
  }, []);

  const closeSearch = React.useCallback(() => {
    setIsSearchOpen(false);
    setSearchDraft('');
  }, []);

  const selectConversationFromSearch = React.useCallback((id: string) => {
    setActiveConversationId(id);
    if (user?.id) {
      activeConversationCacheByUser.set(user.id, id);
    }
    closeSearch();
  }, [closeSearch, user?.id]);

  const handleSidebarHintClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const el = sidebarScrollRef.current;
    if (!el) {
      return;
    }

    const jump = Math.max(180, Math.round(el.clientHeight * 0.7));
    const nextTop = Math.min(el.scrollTop + jump, el.scrollHeight - el.clientHeight);
    el.scrollTo({ top: nextTop, behavior: 'smooth' });
  }, []);

  React.useEffect(() => {
    const el = sidebarScrollRef.current;
    if (!el || isConversationsSidebarCollapsed) {
      setShowSidebarScrollHint(false);
      setIsSidebarScrollActive(false);
      if (sidebarScrollHintDelayTimeoutRef.current != null) {
        window.clearTimeout(sidebarScrollHintDelayTimeoutRef.current);
        sidebarScrollHintDelayTimeoutRef.current = null;
      }
      return;
    }

    const shouldShowHintFromPosition = () => {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      const canScroll = el.scrollHeight - el.clientHeight > 12;
      return canScroll && remaining > 12;
    };

    const scheduleHintReveal = () => {
      if (sidebarScrollHintDelayTimeoutRef.current != null) {
        window.clearTimeout(sidebarScrollHintDelayTimeoutRef.current);
        sidebarScrollHintDelayTimeoutRef.current = null;
      }

      if (!shouldShowHintFromPosition()) {
        setShowSidebarScrollHint(false);
        return;
      }

      sidebarScrollHintDelayTimeoutRef.current = window.setTimeout(() => {
        sidebarScrollHintDelayTimeoutRef.current = null;
        setShowSidebarScrollHint(shouldShowHintFromPosition());
      }, 1000);
    };

    const onScroll = () => {
      setIsSidebarScrollActive(true);
      setShowSidebarScrollHint(false);
      if (sidebarScrollIdleTimeoutRef.current != null) {
        window.clearTimeout(sidebarScrollIdleTimeoutRef.current);
      }
      sidebarScrollIdleTimeoutRef.current = window.setTimeout(() => {
        setIsSidebarScrollActive(false);
        sidebarScrollIdleTimeoutRef.current = null;
        scheduleHintReveal();
      }, 1000);

      if (sidebarScrollHintDelayTimeoutRef.current != null) {
        window.clearTimeout(sidebarScrollHintDelayTimeoutRef.current);
        sidebarScrollHintDelayTimeoutRef.current = null;
      }

      if (!shouldShowHintFromPosition()) {
        setShowSidebarScrollHint(false);
      }
    };

    scheduleHintReveal();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', scheduleHintReveal);

    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', scheduleHintReveal);
      if (sidebarScrollIdleTimeoutRef.current != null) {
        window.clearTimeout(sidebarScrollIdleTimeoutRef.current);
        sidebarScrollIdleTimeoutRef.current = null;
      }
      if (sidebarScrollHintDelayTimeoutRef.current != null) {
        window.clearTimeout(sidebarScrollHintDelayTimeoutRef.current);
        sidebarScrollHintDelayTimeoutRef.current = null;
      }
    };
  }, [conversations, isBootstrapping, isConversationsSidebarCollapsed]);

  React.useEffect(() => {
    const el = layoutContainerRef.current;
    if (!el) {
      return;
    }

    const expandedSidebarWidth = 220;
    const minChatToSidebarRatio = 3;
    const minTotalWidthBeforeAutoCollapse = expandedSidebarWidth + expandedSidebarWidth * minChatToSidebarRatio;

    const evaluateAutoCollapse = () => {
      const width = el.clientWidth;
      const isNarrow = width > 0 && width < minTotalWidthBeforeAutoCollapse;

      if (!isNarrow) {
        if (hasAutoCollapsedForNarrowRef.current && isConversationsSidebarCollapsed) {
          setIsConversationsSidebarCollapsed(false);
        }
        hasAutoCollapsedForNarrowRef.current = false;
        return;
      }

      if (!hasAutoCollapsedForNarrowRef.current && !isConversationsSidebarCollapsed) {
        setIsConversationsSidebarCollapsed(true);
        hasAutoCollapsedForNarrowRef.current = true;
      }
    };

    evaluateAutoCollapse();

    const resizeObserver = new ResizeObserver(() => {
      evaluateAutoCollapse();
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isConversationsSidebarCollapsed]);

  const toggleConversationsSidebar = React.useCallback(() => {
    setIsConversationsSidebarCollapsed((prev) => {
      const next = !prev;
      if (!next) {
        hasAutoCollapsedForNarrowRef.current = true;
      }
      return next;
    });
  }, []);

  return (
  <>
    <div ref={layoutContainerRef} className="h-full w-full bg-white">
      <div
        className={`relative grid h-full grid-cols-1 overflow-hidden transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isConversationsSidebarCollapsed ? 'grid-cols-[40px_minmax(0,1fr)]' : 'grid-cols-[220px_minmax(0,1fr)]'
        }`}
      >
        <aside className="relative overflow-hidden border-r border-gray-200 bg-gray-50 text-gray-900 flex flex-col">
          <div className={`flex h-full min-h-0 flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${sidebarScaleClass}`}>
          <div className="relative px-0 pt-3 pb-3 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
            <button
              type="button"
              onClick={toggleConversationsSidebar}
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
              onClick={openSearch}
              disabled={isBootstrapping}
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
            className={`flex min-h-0 flex-1 overflow-hidden transition-all duration-300 ${
              isConversationsSidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
          <div
            ref={sidebarScrollRef}
            className={`sidebar-scroll-area relative h-full min-h-0 overflow-y-auto overscroll-contain px-1.5 pb-3 pr-1 ${
              isSidebarScrollActive ? 'sidebar-scroll-active' : ''
            }`}
          >
            {isBootstrapping ? (
              <SidebarSkeleton />
            ) : (
            <div className="space-y-1">
              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const title = (conv.title ?? '').trim() || 'Nuevo Chat';
                const isRenamingThis = renamingId === conv.id;
                return (
                  <div
                    key={conv.id}
                    className={`group w-full flex cursor-pointer items-center gap-2 rounded-xl border border-transparent px-3 py-1.5 text-[13px] transition ${
                      isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      if (renamingId) return;
                      setActiveConversationId(conv.id);
                    }}
                  >
                    <div className="min-w-0 flex-1 text-left">
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
                    </div>

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
            )}
            <div
              className={`pointer-events-none sticky bottom-0 z-20 flex justify-center pb-2 pt-2 transition-all duration-300 ${
                showSidebarScrollHint && !isBootstrapping && !isConversationsSidebarCollapsed
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-2 opacity-0'
              }`}
            >
              <button
                type="button"
                onClick={handleSidebarHintClick}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur-sm transition hover:bg-white"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-pulse" />
                Desliza...
              </button>
            </div>
          </div>
          </div>
          </div>
        </aside>

        <button
          type="button"
          onClick={toggleConversationsSidebar}
          className={`absolute top-1/2 z-20 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 p-1 text-gray-500 shadow-sm backdrop-blur-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-gray-700 inline-flex ${
            isConversationsSidebarCollapsed ? 'left-[40px] -translate-x-1/2' : 'left-[220px] -translate-x-1/2'
          }`}
          aria-label={isConversationsSidebarCollapsed ? 'Desplegar conversaciones' : 'Plegar conversaciones'}
        >
          {isConversationsSidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

          <main className="h-full overflow-hidden p-6">
            <div className={`h-full w-full ${mainScaleClass}`}>
              <Cleria
                conversationId={activeConversationId}
                onConversationTitleMaybeUpdated={loadConversations}
                onRequestConversation={ensureConversationForFirstMessage}
                prefetchConversationIds={prefetchConversationIds}
                isBootstrapping={isBootstrapping}
              />
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

      <Dialog open={isSearchOpen} onOpenChange={(open) => (open ? setIsSearchOpen(true) : closeSearch())}>
        <DialogContent hideCloseButton className="overflow-hidden rounded-2xl border border-white/15 bg-[#2F2F2F] p-0 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:max-w-[640px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Buscar chats</DialogTitle>
            <DialogDescription>Busca y selecciona una conversación existente.</DialogDescription>
          </DialogHeader>
          <div className="flex h-[520px] flex-col">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Buscar chats..."
              className="h-8 w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={closeSearch}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
              aria-label="Cerrar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            <button
              type="button"
              onClick={() => {
                void handleNewChat();
                closeSearch();
              }}
              className="mb-3 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-left text-sm font-medium text-slate-100 transition hover:bg-white/10"
            >
              <Edit3 className="h-4 w-4 text-slate-300" />
              Nuevo chat
            </button>

            {isBootstrapping ? (
              <SearchDialogSkeleton />
            ) : groupedSearchResults.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-6 text-center text-sm text-slate-400">
                No se encontraron chats.
              </div>
            ) : (
              groupedSearchResults.map((section) => (
                <div key={section.label} className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400/90">{section.label}</div>
                  <div className="space-y-0.5">
                    {section.items.map((conversation) => {
                      const isActive = conversation.id === activeConversationId;
                      const title = (conversation.title ?? '').trim() || 'Nuevo Chat';

                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => selectConversationFromSearch(conversation.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-5 transition ${
                            isActive ? 'bg-white/16 text-white' : 'text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          <Circle className="h-3 w-3 shrink-0 text-slate-500" />
                          <span className="truncate">{title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx>{`
        .sidebar-scroll-area {
          scrollbar-width: none;
          scrollbar-color: transparent transparent;
        }

        .sidebar-scroll-area::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .sidebar-scroll-area::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: transparent;
        }

        .sidebar-scroll-area::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-scroll-area:hover,
        .sidebar-scroll-area.sidebar-scroll-active {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.66) transparent;
        }

        .sidebar-scroll-area:hover::-webkit-scrollbar-thumb,
        .sidebar-scroll-area.sidebar-scroll-active::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.66);
        }
      `}</style>
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
