'use client';

import * as React from 'react';
import Image from 'next/image';
import { ArrowDown, Check, History, ImagePlus, RotateCw, SendHorizontal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPE_META,
  type FeedbackItem,
  type FeedbackMessage,
} from '@/features/feedback/types';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type FeedbackDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FeedbackItem | null;
  currentUserId: string | null;
};

const formatDateOnly = (iso: string) => {
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

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export function FeedbackDetailDialog({ open, onOpenChange, item, currentUserId }: FeedbackDetailDialogProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = React.useState<FeedbackMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [messageInput, setMessageInput] = React.useState('');
  const [attachment, setAttachment] = React.useState<File | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);

  const activeTypeMeta = item ? FEEDBACK_TYPE_META[item.type] : null;

  const loadMessages = React.useCallback(async () => {
    if (!item?.id) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/feedback-items/${item.id}/messages`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => null)) as { messages?: FeedbackMessage[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'No se pudo cargar la conversación');
      }

      setMessages(Array.isArray(payload?.messages) ? payload.messages : []);
    } catch (error) {
      setMessages([]);
      toast({
        title: 'No se pudo cargar la conversación',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMessages(false);
    }
  }, [item?.id, toast]);

  React.useEffect(() => {
    if (!open || !item?.id) {
      return;
    }

    void loadMessages();
  }, [item?.id, loadMessages, open]);

  React.useEffect(() => {
    if (!open || !item?.id) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`feedback-messages-${item.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback_messages',
          filter: `feedback_id=eq.${item.id}`,
        },
        () => {
          void loadMessages();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [item?.id, loadMessages, open]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const el = messagesContainerRef.current;
    if (!el) {
      return;
    }

    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  React.useEffect(() => {
    if (!open) {
      setMessageInput('');
      setAttachment(null);
      setIsLightboxOpen(false);
      setIsHistoryOpen(false);
    }
  }, [open]);

  React.useEffect(() => {
    setIsHistoryOpen(false);
  }, [item?.id]);

  const closeLightbox = React.useCallback(() => {
    setIsLightboxOpen(false);
  }, []);

  const handleDialogOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isLightboxOpen) {
        setIsLightboxOpen(false);
        return;
      }

      onOpenChange(nextOpen);
    },
    [isLightboxOpen, onOpenChange]
  );

  const contextAttachmentSrc = item ? `/api/feedback-items/${item.id}/attachment` : null;

  const statusHistory = React.useMemo(() => {
    const rawHistory = item?.historico_data ?? null;
    const parsed = rawHistory
      ? Object.entries(rawHistory)
          .map(([changedAt, status]) => ({
            changedAt,
            status,
            timestamp: new Date(changedAt).getTime(),
          }))
          .filter(({ status, timestamp }) => Number.isFinite(timestamp) && status in FEEDBACK_STATUS_LABEL)
      : [];

    if (parsed.length === 0 && item) {
      return [
        {
          changedAt: item.created_at,
          status: item.status,
          timestamp: new Date(item.created_at).getTime(),
        },
      ];
    }

    return parsed.sort((a, b) => a.timestamp - b.timestamp);
  }, [item]);

  const historyRowHeight = 48;
  const historyVisibleRows = statusHistory.length > 5 ? 5.5 : statusHistory.length;
  const historyListHeight = Math.max(historyVisibleRows * historyRowHeight, historyRowHeight);

  const submitMessage = async () => {
    if (!item?.id || isSending || (!messageInput.trim() && !attachment)) {
      return;
    }

    setIsSending(true);

    const body = new FormData();
    body.append('message', messageInput.trim());
    if (attachment) {
      body.append('attachments', attachment);
    }

    try {
      const response = await fetch(`/api/feedback-items/${item.id}/messages`, {
        method: 'POST',
        credentials: 'include',
        body,
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: FeedbackMessage; error?: string }
        | null;

      if (!response.ok || !payload?.message) {
        throw new Error(payload?.error ?? 'No se pudo enviar el mensaje');
      }

      setMessages((prev) => [...prev, payload.message as FeedbackMessage]);
      setMessageInput('');
      setAttachment(null);
    } catch (error) {
      toast({
        title: 'No se pudo enviar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!item || !activeTypeMeta) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        hideCloseButton
        onEscapeKeyDown={(event) => {
          if (isLightboxOpen) {
            event.preventDefault();
            closeLightbox();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isLightboxOpen) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isLightboxOpen) {
            event.preventDefault();
          }
        }}
        className={`w-[calc(100vw-0.75rem)] max-w-none !grid !grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl border bg-white p-0 sm:w-[calc(100vw-2rem)] sm:rounded-3xl lg:w-[min(92vw,920px)] h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-5rem)] sm:max-h-[calc(100vh-5rem)] ${activeTypeMeta.auraClass}`}
      >
        <DialogHeader className="shrink-0 border-b border-slate-200 px-3 pb-3 pt-3 text-left sm:px-5 sm:pb-4 sm:pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <DialogTitle className="text-lg font-semibold tracking-[-0.02em] text-slate-900 sm:text-xl">{item.title}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 font-medium ${activeTypeMeta.tone}`}>
                    {activeTypeMeta.label}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {FEEDBACK_STATUS_LABEL[item.status]}
                  </span>
                  <span>•</span>
                  <span>Creado el {formatDateTime(item.created_at)}</span>
                  <div className="relative inline-flex items-center">
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsHistoryOpen((prev) => !prev);
                      }}
                      aria-label="Ver histórico de estados"
                    >
                      <History className="h-3.5 w-3.5" />
                    </button>

                    {isHistoryOpen ? (
                      <div className="absolute right-0 top-[calc(100%+0.4rem)] z-[140] w-[190px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.16)]">
                        <div className="border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Histórico de estados
                        </div>
                        <div
                          className="overflow-y-auto"
                          style={{
                            height: `${historyListHeight}px`,
                            maxHeight: `${historyRowHeight * 5.5}px`,
                          }}
                        >
                          {statusHistory.map((entry, index) => {
                            const isLast = index === statusHistory.length - 1;
                            const isImplementedLast = isLast && entry.status === 'implementado';
                            const isRejectedLast = isLast && entry.status === 'rechazado';

                            return (
                              <div
                                key={`${entry.changedAt}-${entry.status}-${index}`}
                                className={`flex h-12 items-center justify-between border-b border-slate-100 px-2.5 last:border-b-0 ${
                                  isImplementedLast ? 'bg-emerald-50/70' : isRejectedLast ? 'bg-rose-50/70' : ''
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-[10px] font-semibold text-slate-700">{FEEDBACK_STATUS_LABEL[entry.status]}</div>
                                  <div className="text-[10px] text-slate-500">{formatDateOnly(entry.changedAt)}</div>
                                </div>
                                {isLast ? (
                                  isRejectedLast ? (
                                    <X className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                                  ) : isImplementedLast ? (
                                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  ) : (
                                    <RotateCw className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                  )
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-8 rounded-full p-0 text-slate-500 hover:bg-slate-100"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-5 sm:py-4">
          <div className="grid h-full min-h-0 gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="flex min-h-0 flex-col gap-3 overflow-hidden pr-0.5">
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</h3>
                <p className="feedback-context-scroll min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-[13px] leading-5 text-slate-700">
                  {item.description}
                </p>
              </div>

              <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Imagen adjunta</h3>
                {contextAttachmentSrc ? (
                  <button
                    type="button"
                    className="group relative flex h-[112px] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-1.5 transition hover:border-slate-300 sm:h-[145px]"
                    onClick={() => setIsLightboxOpen(true)}
                  >
                    <Image
                      src={contextAttachmentSrc}
                      alt="Adjunto del feedback"
                      width={1600}
                      height={1000}
                      unoptimized
                      className="h-full max-h-full w-full object-contain"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/0 text-center text-[11px] font-medium text-white opacity-0 transition-all duration-200 group-hover:bg-slate-950/40 group-hover:opacity-100">
                      Click para ampliar
                    </span>
                  </button>
                ) : (
                  <div className="flex h-[112px] w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-400 sm:h-[145px]">
                    Sin imagen adjunta
                  </div>
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3">
              <h3 className="mb-2 shrink-0 text-[13px] font-semibold text-slate-900">Conversación</h3>

              <div
                ref={messagesContainerRef}
                className="feedback-chat-scroll flex-1 min-h-0 space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-slate-50/60 p-2"
              >
                {isLoadingMessages ? (
                  <p className="py-4 text-center text-[11px] text-slate-500">Cargando conversación…</p>
                ) : messages.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-slate-500">
                    No hay mensajes aún. Puedes añadir más detalles o responder aquí.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMine = Boolean(currentUserId) && msg.sender_id === currentUserId;
                    return (
                      <article key={msg.id} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[8px] font-semibold text-slate-700">
                            {msg.sender_initials}
                          </span>
                          <p className="text-[10px] font-medium text-slate-700">{isMine ? 'Tú' : msg.sender_display_name}</p>
                          <span className="text-[10px] text-slate-400">{formatDateTime(msg.created_at)}</span>
                        </div>

                        <p className="whitespace-pre-wrap text-[12px] leading-[1.35rem] text-slate-700">{msg.message}</p>

                        {msg.attachments?.length ? (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {msg.attachments.map((_, index) => (
                              <a
                                key={`${msg.id}-attachment-${index}`}
                                href={`/api/feedback-messages/${msg.id}/attachments/${index}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <ImagePlus className="h-2.5 w-2.5" />
                                Ver adjunto {index + 1}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>

              <div className="mt-2 shrink-0 space-y-1.5 border-t border-slate-200 pt-2">
              <Textarea
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                onPaste={(event) => {
                  const items = Array.from(event.clipboardData?.items ?? []);
                  const imageItem = items.find((entry) => entry.kind === 'file' && entry.type.startsWith('image/'));
                  if (!imageItem) {
                    return;
                  }

                  const file = imageItem.getAsFile();
                  if (!file) {
                    return;
                  }

                  const extension = file.type.split('/')[1] || 'png';
                  const normalizedFile = new File([file], `feedback-chat-paste-${Date.now()}.${extension}`, {
                    type: file.type,
                  });
                  setAttachment(normalizedFile);
                  toast({
                    title: 'Captura pegada',
                    description: 'La imagen se adjuntó al mensaje.',
                  });
                }}
                placeholder="Escribe un mensaje…"
                className="min-h-[56px] max-h-[92px] rounded-lg border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-900 shadow-none focus-visible:ring-slate-300"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setAttachment(file);
                }}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 rounded-lg border-slate-300 bg-white px-2.5 text-[10px] text-slate-700 hover:bg-slate-100"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-2.5 w-2.5" />
                    Adjuntar imagen
                  </Button>
                  {attachment ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 rounded-lg px-2.5 text-[10px] text-slate-600 hover:bg-slate-100"
                      onClick={() => setAttachment(null)}
                    >
                      Quitar ({attachment.name})
                    </Button>
                  ) : null}
                </div>

                <Button
                  type="button"
                  onClick={() => void submitMessage()}
                  disabled={isSending || (!messageInput.trim() && !attachment)}
                  className="h-7 rounded-lg bg-slate-900 px-3 text-[10px] font-semibold text-white hover:bg-slate-800"
                >
                  <SendHorizontal className="h-2.5 w-2.5" />
                  {isSending ? 'Enviando…' : 'Enviar'}
                </Button>
              </div>
            </div>
            </section>
          </div>
        </div>

        <style jsx global>{`
          .feedback-dialog-mobile-scroll {
            -webkit-overflow-scrolling: touch;
          }

          .feedback-chat-scroll {
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.75) rgba(226, 232, 240, 0.55);
            -webkit-overflow-scrolling: touch;
          }

          .feedback-context-scroll {
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.7) rgba(226, 232, 240, 0.45);
            -webkit-overflow-scrolling: touch;
          }

          .feedback-chat-scroll::-webkit-scrollbar {
            width: 8px;
          }

          .feedback-context-scroll::-webkit-scrollbar {
            width: 7px;
          }

          .feedback-chat-scroll::-webkit-scrollbar-track {
            border-radius: 999px;
            background: rgba(226, 232, 240, 0.55);
          }

          .feedback-context-scroll::-webkit-scrollbar-track {
            border-radius: 999px;
            background: rgba(226, 232, 240, 0.45);
          }

          .feedback-chat-scroll::-webkit-scrollbar-thumb {
            border-radius: 999px;
            background: rgba(148, 163, 184, 0.75);
          }

          .feedback-context-scroll::-webkit-scrollbar-thumb {
            border-radius: 999px;
            background: rgba(148, 163, 184, 0.7);
          }
        `}</style>

      </DialogContent>

      {isLightboxOpen && contextAttachmentSrc ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/88 p-3 sm:p-6"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) {
              closeLightbox();
            }
          }}
        >
          <button
            type="button"
            className="absolute right-3 top-3 z-[131] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 sm:right-6 sm:top-6"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              closeLightbox();
            }}
            aria-label="Cerrar imagen"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            className="relative h-[88vh] w-[95vw] max-w-[1600px]"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <Image src={contextAttachmentSrc} alt="Adjunto ampliado" fill unoptimized className="object-contain" sizes="95vw" priority />
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
