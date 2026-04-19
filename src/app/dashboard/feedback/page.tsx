'use client';

import * as React from 'react';
import { Bug, Lightbulb, Sparkles } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { FeedbackComposerDialog } from '@/features/feedback/FeedbackComposerDialog';
import { FeedbackDetailDialog } from '@/features/feedback/FeedbackDetailDialog';
import {
  FEEDBACK_STATUS_COLUMNS,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPE_META,
  type FeedbackItem,
  type FeedbackType,
} from '@/features/feedback/types';

const TYPE_ICON: Record<FeedbackType, React.ReactNode> = {
  mejora: <Sparkles className="h-4 w-4" />,
  idea: <Lightbulb className="h-4 w-4" />,
  error: <Bug className="h-4 w-4" />,
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const EmptyColumnState = () => (
  <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-2.5 py-4 text-center text-[11px] text-slate-400">
    Sin solicitudes aún
  </div>
);

export default function FeedbackPage() {
  const { user } = useDashboardSession();
  const [isLoading, setIsLoading] = React.useState(true);
  const [items, setItems] = React.useState<FeedbackItem[]>([]);
  const [onlyMine, setOnlyMine] = React.useState(false);

  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  const [composerInitialType, setComposerInitialType] = React.useState<FeedbackType | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<FeedbackItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  const loadItems = React.useCallback(async (mineOnly: boolean) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/feedback-items?onlyMine=${mineOnly ? '1' : '0'}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => null)) as { items?: FeedbackItem[] } | null;
      if (!response.ok) {
        setItems([]);
        return;
      }

      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadItems(onlyMine);
  }, [loadItems, onlyMine]);

  const handleQuickCreate = (type: FeedbackType) => {
    setComposerInitialType(type);
    setIsComposerOpen(true);
  };

  const openDetail = (item: FeedbackItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  const grouped = React.useMemo(() => {
    const map = new Map<string, FeedbackItem[]>();
    FEEDBACK_STATUS_COLUMNS.forEach((column) => {
      map.set(column.id, []);
    });

    items.forEach((item) => {
      if (!map.has(item.status)) {
        map.set(item.status, []);
      }
      map.get(item.status)?.push(item);
    });

    FEEDBACK_STATUS_COLUMNS.forEach((column) => {
      map.get(column.id)?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    return map;
  }, [items]);

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 pb-4">
      <div className="space-y-1.5">
        <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-slate-900">Ayudanos a mejorar</h1>
        <p className="max-w-2xl text-[13px] leading-5 text-slate-500">
          Comparte mejoras, ideas y errores en un único flujo. Diseñado para priorizar con claridad y mantener visibilidad del estado.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[226px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)] lg:sticky lg:top-6 lg:h-fit">
          <div className="mb-3 space-y-0.5">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Nuevo feedback</h2>
            <p className="text-[12px] text-slate-500">¿Qué quieres compartir?</p>
          </div>

          <div className="space-y-2">
            {(Object.keys(FEEDBACK_TYPE_META) as FeedbackType[]).map((type) => {
              const meta = FEEDBACK_TYPE_META[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleQuickCreate(type)}
                  className={`group w-full rounded-xl border px-3 py-3 text-left transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_12px_22px_rgba(15,23,42,0.08)] ${meta.surface} ${meta.hover}`}
                >
                  <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-current/20 bg-white/75 text-current transition-colors group-hover:bg-white">
                    {TYPE_ICON[type]}
                  </span>
                  <p className="text-[13px] font-semibold">{meta.label}</p>
                  <p className="mt-0.5 text-[11px] text-current/70">Abrir formulario con tipo preseleccionado.</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="inline-flex select-none items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-700">
              <Checkbox checked={onlyMine} onCheckedChange={(checked) => setOnlyMine(Boolean(checked))} />
              Mostrar solo mis solicitudes
            </label>
          </div>

          <div className="feedback-kanban-scroll overflow-x-auto pb-1.5">
            <div className="min-w-[1160px]">
              <div className="grid grid-cols-6 gap-3">
                {FEEDBACK_STATUS_COLUMNS.map((column) => {
                  const columnItems = grouped.get(column.id) ?? [];
                  return (
                    <div key={column.id} className="flex min-h-[460px] flex-col rounded-xl border border-slate-200 bg-slate-50/65 p-2.5">
                      <div className="mb-2.5 flex items-center justify-between">
                        <h3 className="text-[13px] font-semibold text-slate-700">{column.label}</h3>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
                          {columnItems.length}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {isLoading ? (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-2.5 py-4 text-center text-[11px] text-slate-400">
                            Cargando…
                          </div>
                        ) : columnItems.length === 0 ? (
                          <EmptyColumnState />
                        ) : (
                          columnItems.map((item) => {
                            const typeMeta = FEEDBACK_TYPE_META[item.type];
                            const participants = (item.participant_initials ?? []).filter(Boolean).slice(0, 5);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => openDetail(item)}
                                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-[0_5px_16px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_22px_rgba(15,23,42,0.1)]"
                              >
                                <h4 className="line-clamp-2 text-[13px] font-semibold leading-4.5 text-slate-900">{item.title}</h4>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${typeMeta.tone}`}>
                                    {typeMeta.shortLabel}
                                  </span>
                                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                    {FEEDBACK_STATUS_LABEL[item.status]}
                                  </span>
                                </div>
                                <div className="mt-2.5 flex items-end justify-between gap-2">
                                  <p className="text-[10px] text-slate-500">{formatDate(item.created_at)}</p>
                                  <div className="flex items-center -space-x-1.5">
                                    {participants.map((initials, index) => (
                                      <span
                                        key={`${item.id}-participant-${index}`}
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white bg-slate-200 text-[8px] font-semibold uppercase text-slate-700"
                                        title={`Participante ${initials}`}
                                      >
                                        {initials}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <style jsx global>{`
            .feedback-kanban-scroll {
              scrollbar-width: thin;
              scrollbar-color: rgba(148, 163, 184, 0.9) rgba(226, 232, 240, 0.55);
            }

            .feedback-kanban-scroll::-webkit-scrollbar {
              height: 10px;
            }

            .feedback-kanban-scroll::-webkit-scrollbar-track {
              border-radius: 999px;
              background: rgba(226, 232, 240, 0.55);
            }

            .feedback-kanban-scroll::-webkit-scrollbar-thumb {
              border-radius: 999px;
              background: rgba(148, 163, 184, 0.9);
            }

            .feedback-kanban-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(100, 116, 139, 0.95);
            }
          `}</style>
        </section>
      </div>

      <FeedbackComposerDialog
        open={isComposerOpen}
        onOpenChange={setIsComposerOpen}
        initialType={composerInitialType}
        startWithTypeSelection={false}
        onSubmitted={(item) => {
          setItems((prev) => [item, ...prev]);
        }}
      />

      <FeedbackDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        item={selectedItem}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
