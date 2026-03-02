"use client";

import Image from 'next/image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { Download, Eye, Sparkles, X } from 'lucide-react';

type CleriaBackendType = 'count' | 'sum_total' | 'sum_sin_iva' | 'sum_iva' | 'list' | 'error';

type CleriaBackendResponse = {
  response: string;
  type: CleriaBackendType;
  data: unknown;
};

type CleriaListInvoiceRow = {
  id?: string | number;
  numero?: string | number | null;
  fecha?: string | null;
  tipo?: string | null;
  counterparty?: string | null;
  importe_total?: number | string | null;
  divisa?: string | null;
  drive_type?: string | null;
  drive_file_id?: string | null;
  buyer_name?: string | null;
  buyer_tax_id?: string | null;
  seller_name?: string | null;
  seller_tax_id?: string | null;
  invoice_concept?: string | null;
  importe_sin_iva?: number | string | null;
  iva?: number | string | null;
  descuentos?: number | string | null;
  retenciones?: number | string | null;
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  responseType?: CleriaBackendType;
  responseData?: unknown;
  createdAt?: string | null;
  clientStatus?: 'cancelled' | null;
};

type TimelineItem =
  | { kind: 'separator'; id: string; label: string }
  | { kind: 'message'; message: ChatMessage };

type CleriaMessageRow = {
  id: string;
  conversation_id: string;
  role: 'assistant' | 'user' | string;
  content: string;
  type: string | null;
  metadata: unknown;
  created_at: string | null;
};

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '¡Hola! Soy Cler, ¿en qué puedo ayudarte?',
};

type CleriaProps = {
  conversationId: string | null;
  onConversationTitleMaybeUpdated?: () => void;
};

const Cleria: React.FC<CleriaProps> = ({ conversationId, onConversationTitleMaybeUpdated }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isWaitingResponse, setIsWaitingResponse] = useState(false);
  const [waitingText, setWaitingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { user } = useDashboardSession();
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingUserMessageIdRef = useRef<string | null>(null);
  const [drawerRow, setDrawerRow] = useState<CleriaListInvoiceRow | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!conversationId) {
        setMessages([WELCOME_MESSAGE]);
        return;
      }

      const res = await fetch(`/api/cleria/conversation/${encodeURIComponent(conversationId)}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        setMessages([WELCOME_MESSAGE]);
        return;
      }

      const data = (await res.json().catch(() => null)) as CleriaMessageRow[] | null;
      if (!data) {
        setMessages([WELCOME_MESSAGE]);
        return;
      }

      const mapped = (data as CleriaMessageRow[])
        .filter((row) => row.role === 'assistant' || row.role === 'user')
        .map((row) => {
          const cancelled =
            row.role === 'user' &&
            typeof row.metadata === 'object' &&
            row.metadata !== null &&
            (row.metadata as { status?: unknown })?.status === 'cancelled';

          const msg = {
            id: row.id,
            role: row.role as 'assistant' | 'user',
            content: row.content,
            responseType: row.role === 'assistant' && row.type ? (row.type as CleriaBackendType) : undefined,
            responseData: row.role === 'assistant' ? row.metadata : undefined,
            createdAt: row.created_at,
            clientStatus: cancelled ? ('cancelled' as const) : null,
          } satisfies ChatMessage;

          return msg;
        });

      setMessages(mapped.length > 0 ? mapped : [WELCOME_MESSAGE]);
    };

    void run();
  }, [conversationId]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      const threshold = 100;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScrollRef.current = distanceFromBottom <= threshold;
    };

    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!isWaitingResponse) {
      setWaitingText('');
      return;
    }

    const full = 'Dame un momento...';
    let i = 0;
    setWaitingText('');

    const id = window.setInterval(() => {
      i += 1;
      setWaitingText(full.slice(0, i));
      if (i >= full.length) {
        window.clearInterval(id);
      }
    }, 35);

    return () => {
      window.clearInterval(id);
    };
  }, [isWaitingResponse]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, 160);
    const finalHeight = Math.max(next, 44);
    el.style.height = `${finalHeight}px`;
  }, [draft]);

  const isChatReady = Boolean(user?.id && conversationId);

  const canSend = useMemo(() => {
    if (!isChatReady) return false;
    if (isWaitingResponse) return false;
    return draft.trim().length > 0;
  }, [draft, isChatReady, isWaitingResponse]);

  const formatCurrency = (value: unknown, currency: string | null | undefined = 'EUR') => {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(n)) return '—';

    const formatted = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

    if (!currency || currency === 'EUR') {
      return `${formatted} €`;
    }
    return `${formatted} ${currency}`;
  };

  const formatCount = (value: unknown) => {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n);
  };

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfToday - startOfThat) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';

    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  };

  const formatShortDate = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  };

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const out: TimelineItem[] = [];
    let lastLabel: string | null = null;

    for (const m of messages) {
      const createdAt = m.createdAt ?? null;
      if (createdAt) {
        const label = formatDateLabel(createdAt);
        if (label && label !== lastLabel) {
          out.push({ kind: 'separator', id: `sep-${createdAt}-${label}`, label });
          lastLabel = label;
        }
      }

      out.push({ kind: 'message', message: m });
    }

    return out;
  }, [messages]);

  const emptySuggestions = useMemo(
    () => [
      '¿Cuántas facturas tengo este mes?',
      'Muéstrame mis últimos gastos',
      '¿Qué facturas superan 500 €?',
      'Dame el total de ingresos de este año',
    ],
    []
  );

  const buildNaturalMetricText = (type: CleriaBackendType, value: unknown, userPrompt?: string) => {
    const prompt = (userPrompt ?? '').toLowerCase();
    const metricNoun = prompt.includes('ingres') ? 'facturas de ingresos' : prompt.includes('gasto') ? 'facturas de gastos' : 'facturas';

    if (type === 'count') {
      const n = formatCount(value);
      return n === '—'
        ? `Actualmente tienes ${metricNoun} registradas.`
        : `Actualmente tienes ${n} ${metricNoun} registradas.`;
    }

    const money = formatCurrency(value);
    if (type === 'sum_total') {
      return money === '—' ? 'El importe total asciende a.' : `El importe total asciende a ${money}.`;
    }
    if (type === 'sum_iva') {
      return money === '—' ? 'El IVA total acumulado es.' : `El IVA total acumulado es de ${money}.`;
    }
    if (type === 'sum_sin_iva') {
      return money === '—' ? 'El total sin IVA asciende a.' : `El total sin IVA asciende a ${money}.`;
    }

    return '';
  };

  const renderAssistantExtras = (m: ChatMessage) => {
    if (m.role !== 'assistant' || !m.responseType) {
      return null;
    }

    if (m.responseType === 'list') {
      const rows: CleriaListInvoiceRow[] = Array.isArray(m.responseData) ? (m.responseData as CleriaListInvoiceRow[]) : [];
      if (rows.length === 0) {
        return <div className="mt-3 text-sm text-slate-600">No se encontraron resultados</div>;
      }

      const getTipoBadge = (tipo: string) => {
        const normalized = tipo.toLowerCase();
        if (normalized.includes('ingreso')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
        if (normalized.includes('gasto')) return 'bg-red-50 text-red-700 ring-red-200';
        if (normalized.includes('revisar')) return 'bg-amber-50 text-amber-800 ring-amber-200';
        if (normalized.includes('no factura')) return 'bg-slate-50 text-slate-700 ring-slate-200';
        return 'bg-slate-50 text-slate-700 ring-slate-200';
      };

      return (
        <div className="mt-3 flex justify-center">
          <div className="w-full max-w-[980px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full table-auto border-collapse">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-left text-[12px] font-semibold text-slate-600 border-b border-slate-200">
                <th className="py-2 pr-3 pl-4 w-40">Número</th>
                <th className="py-2 pr-3 w-28">Fecha</th>
                <th className="py-2 pr-3 w-28">Tipo</th>
                <th className="py-2 pr-3">Contraparte</th>
                <th className="py-2 pr-4 w-28 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="text-[13px] text-slate-800">
                {rows.map((row, idx) => {
                  const counterparty = row.counterparty || '-';
                  const tipo = String(row.tipo ?? '');
                  const divisa = row.divisa ?? 'EUR';
                  const importe = formatCurrency(row.importe_total, divisa);
                  const stableKey = String(row.id ?? row.drive_file_id ?? row.numero ?? `${idx}`);
                  return (
                    <tr
                      key={stableKey}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                      onClick={() => setDrawerRow(row)}
                    >
                      <td className="py-2 pr-3 pl-4 whitespace-nowrap">{String(row.numero ?? '')}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatShortDate(row.fecha)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ${getTipoBadge(tipo)}`}>
                          {tipo || '—'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 min-w-[220px]">
                        <div className="truncate" title={counterparty}>
                          {counterparty}
                        </div>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap text-right font-mono">{importe}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const handleSend = async (overrideText?: string) => {
    const text = String(overrideText ?? draft).trim();
    if (!text) return;

    if (!user?.id) {
      return;
    }

    if (!conversationId) {
      return;
    }

    const isFirstUserMessage = messages.some((m) => m.role === 'user') === false;

    const nowIso = new Date().toISOString();
    const optimisticUserId = `${Date.now()}`;

    setMessages((prev) => [...prev, { id: optimisticUserId, role: 'user', content: text, createdAt: nowIso }]);

    setDraft('');
    pendingUserMessageIdRef.current = optimisticUserId;

    setIsWaitingResponse(true);
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    try {
      const res = await fetch('/api/cleria/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          user_uid: user.id,
          empresa_id: user.empresaId,
          conversation_id: conversationId,
          message: text,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || `Request failed (${res.status})`);
      }

      const json = (await res.json().catch(() => null)) as CleriaBackendResponse | null;
      const backendType: CleriaBackendType = json?.type ?? 'error';
      const backendData = json?.data;
      const backendTextRaw = json?.response ?? 'No se pudo procesar la respuesta.';
      const metricValue = (backendData as { value?: unknown } | null)?.value;
      const backendText =
        backendType === 'count' || backendType === 'sum_total' || backendType === 'sum_sin_iva' || backendType === 'sum_iva'
          ? buildNaturalMetricText(backendType, metricValue, text) || backendTextRaw
          : backendTextRaw;

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: backendText,
          responseType: backendType,
          responseData: backendData,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (isFirstUserMessage) {
        onConversationTitleMaybeUpdated?.();
      }
    } catch (error) {
      const isAborted = error instanceof DOMException && error.name === 'AbortError';
      if (!isAborted) {
        console.error('Error recibiendo respuesta de n8n (cleria_message)', error);
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-assistant`,
            role: 'assistant',
            content: 'No se pudo obtener respuesta. Inténtalo de nuevo.',
            responseType: 'error',
            responseData: null,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsWaitingResponse(false);
      abortControllerRef.current = null;
      pendingUserMessageIdRef.current = null;
    }
  };

  const handleCancelResponse = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    const pendingId = pendingUserMessageIdRef.current;
    pendingUserMessageIdRef.current = null;
    if (pendingId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, clientStatus: 'cancelled' } : m))
      );
    }
    setIsWaitingResponse(false);
    setWaitingText('');
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] h-full flex flex-col pt-6 px-2 sm:px-4">
      <div className="flex flex-col items-center text-center">
        <div className="relative h-14 w-14">
          <Image
            src="/brand/tab_cleria/cleria_color_logo.png"
            alt="Cler IA"
            fill
            sizes="56px"
            className="object-contain"
            priority
          />
        </div>

        <h1 className="mt-5 text-3xl font-semibold text-gray-900">Cler IA</h1>
        <p className="mt-2 text-sm text-gray-500 max-w-xl">
          Cler IA está para ayudarte a saber cualquier cosa respecto a los datos financieros de tu empresa.
        </p>
      </div>

      <div className="mt-10 flex-1 min-h-0 flex flex-col">
        <div ref={scrollContainerRef} className="flex-1 min-h-0 px-5 py-5 overflow-auto pr-2">
          <div className="space-y-4">
            {timelineItems.map((item) => {
              if (item.kind === 'separator') {
                return (
                  <div key={item.id} className="flex items-center justify-center py-2">
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-600">
                      {item.label}
                    </div>
                  </div>
                );
              }

              const m = item.message;
              const isAssistant = m.role === 'assistant';
              const isErrorAssistant = isAssistant && m.responseType === 'error';

              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isAssistant ? 'items-end justify-start' : 'items-center justify-end'}`}
                >
                  {isAssistant ? (
                    <div className="relative h-9 w-9 flex-shrink-0">
                      <Image
                        src="/brand/tab_cleria/cleria_color_logo.png"
                        alt="Cler IA"
                        fill
                        sizes="36px"
                        className="object-contain"
                      />
                    </div>
                  ) : null}

                  {isAssistant ? (
                    <div className="max-w-[85%] text-sm leading-relaxed">
                      <div className={isErrorAssistant ? 'text-red-600' : 'text-gray-700'}>{m.content}</div>
                      {isErrorAssistant ? null : renderAssistantExtras(m)}
                    </div>
                  ) : (
                    <div className="flex flex-col items-end max-w-[85%]">
                      <div className="w-full rounded-2xl px-4 py-2.5 text-sm leading-relaxed border shadow-sm relative overflow-hidden text-white border-blue-700/20 bg-[linear-gradient(180deg,#1C63F2_0%,#0E4AD8_55%,#0A3AA6_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-10px_30px_rgba(0,0,0,0.10),0_10px_30px_rgba(15,23,42,0.12)]">
                        <div className="cler-ia-shimmer pointer-events-none absolute -left-1/2 top-[-35%] h-[170%] w-[120%] rotate-12 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.20)_18%,rgba(255,255,255,0.08)_40%,rgba(255,255,255,0)_60%)] opacity-70 blur-[0.2px]" />
                        <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[radial-gradient(120%_90%_at_25%_10%,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_55%)]" />
                        <span className={`relative z-10 ${m.clientStatus === 'cancelled' ? 'opacity-70' : ''}`}>{m.content}</span>
                      </div>
                      {m.clientStatus === 'cancelled' ? (
                        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[12px] font-semibold text-red-700">
                          Mensaje cancelado
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}

            {isWaitingResponse ? (
              <div className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-3 justify-start">
                  <div className="relative h-9 w-9 flex-shrink-0">
                    <Image
                      src="/brand/tab_cleria/cleria_color_logo.png"
                      alt="Cler IA"
                      fill
                      sizes="36px"
                      className="object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
                    <span>{waitingText || 'Dame un momento...'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelResponse}
                  className="ml-12 text-[12px] text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="mt-auto border-t border-gray-200 px-5 py-4">
          <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">¿Qué quieres saber sobre tus facturas?</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {emptySuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!isChatReady || isWaitingResponse}
                  onClick={() => void handleSend(s)}
                  className="text-left rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-slate-500" />
                    <div className="text-[13px] text-slate-800">{s}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <label className="sr-only" htmlFor="cler-ia-input">
            Escribe tu mensaje
          </label>
          <textarea
            id="cler-ia-input"
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend) {
                  void handleSend();
                }
              }
            }}
            placeholder={isChatReady ? 'Escribe un mensaje…' : 'Cargando conversación…'}
            disabled={!isChatReady || isWaitingResponse}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-5 text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 overflow-y-auto disabled:opacity-60"
          />
        </div>
      </div>

      <style jsx>{`
        .cler-ia-shimmer {
          transform: translateX(-60%) rotate(12deg);
          animation: clerIaShimmer 6s ease-in-out infinite;
          will-change: transform;
        }

        .animate-cleria-sheet-in {
          animation: cleriaSheetIn 800ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
        }

        @keyframes clerIaShimmer {
          0% {
            transform: translateX(-60%) rotate(12deg);
          }
          50% {
            transform: translateX(35%) rotate(12deg);
          }
          100% {
            transform: translateX(120%) rotate(12deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cler-ia-shimmer {
            animation: none;
          }

          .animate-cleria-sheet-in {
            animation: none;
          }
        }

        @keyframes cleriaSheetIn {
          from {
            transform: translateX(110%);
          }
          to {
            transform: translateX(0px);
          }
        }
      `}</style>

      {drawerRow ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/30"
            onClick={() => setDrawerRow(null)}
          />

          {(() => {
            const driveType = String(drawerRow.drive_type ?? '').trim();
            const driveFileId = String(drawerRow.drive_file_id ?? '').trim();
            const canOpen = Boolean(driveType && driveFileId);

            const previewHref = canOpen
              ? `/api/files/open?drive_type=${encodeURIComponent(driveType)}&drive_file_id=${encodeURIComponent(
                  driveFileId
                )}&kind=preview`
              : undefined;
            const downloadHref = canOpen
              ? `/api/files/open?drive_type=${encodeURIComponent(driveType)}&drive_file_id=${encodeURIComponent(
                  driveFileId
                )}&kind=download`
              : undefined;

            const currency = drawerRow.divisa ?? 'EUR';
            const renderValue = (value: unknown) => {
              const text = String(value ?? '').trim();
              return text ? text : '—';
            };

            const renderMoney = (value: unknown) => {
              const formatted = formatCurrency(value, currency);
              return formatted || '—';
            };

            const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[12px] font-semibold tracking-wide text-slate-700 uppercase">{title}</div>
                <div className="mt-3">{children}</div>
              </div>
            );

            const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
              <div>
                <div className="text-[11px] font-semibold text-slate-500">{label}</div>
                <div className="mt-0.5 text-sm text-slate-900">{value}</div>
              </div>
            );

            return (
              <div className="absolute right-3 top-3 bottom-3 w-[92vw] max-w-[520px]">
                <div className="h-full rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl overflow-hidden animate-cleria-sheet-in">
                  <div className="flex items-center justify-between gap-3 bg-white px-5 py-4 border-b border-slate-200">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">Detalle de factura</div>
                      <div className="mt-0.5 text-[12px] text-slate-500 truncate">{String(drawerRow.numero ?? '—')}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={previewHref ?? '#'}
                        target={previewHref ? '_blank' : undefined}
                        rel={previewHref ? 'noopener,noreferrer' : undefined}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition ${canOpen ? 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50' : 'border-slate-100 bg-slate-50 text-slate-400 pointer-events-none'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Eye className="h-4 w-4" />
                        Vista previa
                      </a>
                      <button
                        type="button"
                        disabled={!canOpen}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (downloadHref) window.open(downloadHref, '_blank', 'noopener,noreferrer');
                        }}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition ${canOpen ? 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                      >
                        <Download className="h-4 w-4" />
                        Descargar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrawerRow(null)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        aria-label="Cerrar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="h-full overflow-y-auto px-5 py-4 pb-6">
                    <div className="space-y-3">
                      <Section title="Resumen">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Field label="Número" value={renderValue(drawerRow.numero)} />
                          <Field label="Fecha" value={formatShortDate(drawerRow.fecha)} />
                          <Field label="Tipo" value={renderValue(drawerRow.tipo)} />
                        </div>
                        <div className="mt-3">
                          <Field label="Contraparte" value={renderValue(drawerRow.counterparty)} />
                        </div>
                      </Section>

                      <Section title="Comprador">
                        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
                          <Field label="CIF/NIF" value={renderValue(drawerRow.buyer_tax_id)} />
                          <Field label="Nombre" value={renderValue(drawerRow.buyer_name)} />
                        </div>
                      </Section>

                      <Section title="Vendedor">
                        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
                          <Field label="CIF/NIF" value={renderValue(drawerRow.seller_tax_id)} />
                          <Field label="Nombre" value={renderValue(drawerRow.seller_name)} />
                        </div>
                      </Section>

                      <Section title="Importes">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Field label="IVA" value={<span className="font-mono">{renderMoney(drawerRow.iva)}</span>} />
                          <Field
                            label="Descuentos"
                            value={<span className="font-mono">{renderMoney(drawerRow.descuentos)}</span>}
                          />
                          <Field
                            label="Retenciones"
                            value={<span className="font-mono">{renderMoney(drawerRow.retenciones)}</span>}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field
                            label="Importe sin IVA"
                            value={<span className="font-mono font-semibold">{renderMoney(drawerRow.importe_sin_iva)}</span>}
                          />
                          <Field
                            label="Importe total"
                            value={<span className="font-mono font-semibold">{renderMoney(drawerRow.importe_total)}</span>}
                          />
                        </div>
                      </Section>

                      <Section title="Concepto">
                        <Field label="Descripción" value={renderValue(drawerRow.invoice_concept)} />
                      </Section>
                    </div>
                  </div>
                </div>

              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
};

export default Cleria;
