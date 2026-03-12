"use client";

import Image from 'next/image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardSession } from '@/context/dashboard-session-context';
import { ChevronUp, Download, Eye, Sparkles, X } from 'lucide-react';

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

type ScrollableResultsTableProps = {
  rows: CleriaListInvoiceRow[];
  formatCurrency: (value: unknown, currency?: string | null | undefined) => string;
  formatShortDate: (value: string | null | undefined) => string;
  getTipoBadge: (value: string) => string;
  onRowClick: (row: CleriaListInvoiceRow) => void;
};

const ScrollableResultsTable: React.FC<ScrollableResultsTableProps> = ({
  rows,
  formatCurrency,
  formatShortDate,
  getTipoBadge,
  onRowClick,
}) => {
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) {
      setShowScrollHint(false);
      return;
    }

    const updateScrollHint = () => {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollHint(remaining > 12);
    };

    updateScrollHint();
    el.addEventListener('scroll', updateScrollHint, { passive: true });
    window.addEventListener('resize', updateScrollHint);

    return () => {
      el.removeEventListener('scroll', updateScrollHint);
      window.removeEventListener('resize', updateScrollHint);
    };
  }, [rows]);

  return (
    <div className="mt-3 flex justify-center">
      <div className="w-full max-w-[980px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="relative">
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-2 transition-all duration-300 ${
              showScrollHint ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
          >
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/88 px-2.5 py-1 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-pulse" />
              Desliza para ver más
            </div>
          </div>
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-white via-white/82 to-transparent transition-opacity duration-300 ${
              showScrollHint ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div ref={tableScrollRef} className="max-h-[238px] overflow-y-auto pr-1">
            <table className="w-full table-auto border-collapse">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600">
                  <th className="w-40 py-2 pr-3 pl-4">Número</th>
                  <th className="w-28 py-2 pr-3">Fecha</th>
                  <th className="w-28 py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Contraparte</th>
                  <th className="w-28 py-2 pr-4 text-right">Importe</th>
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
                      className="cursor-pointer border-b border-slate-100 transition-colors duration-150 hover:bg-slate-50"
                      onClick={() => onRowClick(row)}
                    >
                      <td className="whitespace-nowrap py-2 pr-3 pl-4">{String(row.numero ?? '')}</td>
                      <td className="whitespace-nowrap py-2 pr-3">{formatShortDate(row.fecha)}</td>
                      <td className="whitespace-nowrap py-2 pr-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ${getTipoBadge(tipo)}`}>
                          {tipo || '—'}
                        </span>
                      </td>
                      <td className="min-w-[220px] py-2 pr-3">
                        <div className="truncate" title={counterparty}>
                          {counterparty}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right font-mono">{importe}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(false);
  const [animatedMessageId, setAnimatedMessageId] = useState<string | null>(null);

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

  const hasStartedConversation = useMemo(
    () => draft.trim().length > 0 || isWaitingResponse || messages.some((m) => m.role === 'user'),
    [draft, isWaitingResponse, messages]
  );

  const hasUserMessages = useMemo(() => messages.some((m) => m.role === 'user'), [messages]);

  const showExpandedHero = !hasStartedConversation;

  useEffect(() => {
    setSuggestionsCollapsed(hasUserMessages);
  }, [conversationId, hasUserMessages]);

  useEffect(() => {
    if (!animatedMessageId) {
      return;
    }

    const id = window.setTimeout(() => {
      setAnimatedMessageId((current) => (current === animatedMessageId ? null : current));
    }, 650);

    return () => window.clearTimeout(id);
  }, [animatedMessageId]);

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
      '¿Cuántas facturas tengo este año?',
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
        <ScrollableResultsTable
          rows={rows}
          formatCurrency={formatCurrency}
          formatShortDate={formatShortDate}
          getTipoBadge={getTipoBadge}
          onRowClick={(row) => setDrawerRow(row)}
        />
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
    setAnimatedMessageId(optimisticUserId);
    setSuggestionsCollapsed(true);

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
    <div className="mx-auto flex h-full w-full max-w-[1360px] flex-col px-3 pb-3 pt-4 sm:px-5">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={`absolute left-1/2 top-[-8px] z-10 -translate-x-1/2 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            hasStartedConversation
              ? 'translate-y-0 opacity-100'
              : '-translate-y-3 opacity-0 pointer-events-none'
          }`}
        >
          <div className="cler-ia-pill-wrap scale-[0.96]">
            <div className="cler-ia-halo cler-ia-halo-one" />
            <div className="cler-ia-halo cler-ia-halo-two" />
            <div className="cler-ia-halo cler-ia-halo-three" />
            <div className="relative inline-flex items-center gap-3 rounded-full px-4 py-2.5">
              <div className="absolute inset-[1px] rounded-full bg-white/84 backdrop-blur-md" />
              <div className="cler-ia-pill-liquid absolute inset-[1px] rounded-full" />
              <div className="relative h-9 w-9 flex-shrink-0">
                <Image
                  src="/brand/tab_cleria/cleria_color_logo.png"
                  alt="Cler IA"
                  fill
                  sizes="36px"
                  className="object-contain"
                  priority
                />
              </div>
              <div className="relative text-left">
                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Cler IA</div>
                <div className="text-[11px] text-slate-500">Asistente financiero</div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            hasStartedConversation
              ? 'pointer-events-none max-h-0 -translate-y-4 opacity-0 mb-0 overflow-hidden'
              : 'max-h-[260px] translate-y-0 opacity-100 mb-4 overflow-visible sm:mb-5'
          }`}
        >
          <div className="flex flex-col items-center px-4 pb-4 pt-5 text-center">
            <div className="cler-ia-pill-wrap transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div className="cler-ia-halo cler-ia-halo-one" />
              <div className="cler-ia-halo cler-ia-halo-two" />
              <div className="cler-ia-halo cler-ia-halo-three" />
              <div className="relative inline-flex items-center gap-3 rounded-full px-4 py-2.5">
                <div className="absolute inset-[1px] rounded-full bg-white/84 backdrop-blur-md" />
                <div className="cler-ia-pill-liquid absolute inset-[1px] rounded-full" />
                <div className="relative h-9 w-9 flex-shrink-0">
                  <Image
                    src="/brand/tab_cleria/cleria_color_logo.png"
                    alt="Cler IA"
                    fill
                    sizes="36px"
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="relative text-left">
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Cler IA</div>
                  <div className="text-[11px] text-slate-500">Asistente financiero</div>
                </div>
              </div>
            </div>

            <p className="mt-3 max-w-[760px] text-[12px] leading-5 text-gray-500 sm:text-[13px]">
              Cler IA está para ayudarte a saber cualquier cosa respecto a los datos financieros de tu empresa.
            </p>
          </div>
        </div>

        <div className={`flex min-h-0 flex-1 flex-col transition-all duration-500 ${hasStartedConversation ? 'pt-20 sm:pt-24' : 'pt-0'}`}>
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto px-2 py-2 pr-1 sm:px-3 sm:py-3">
          <div className="space-y-2.5">
            {timelineItems.map((item) => {
              if (item.kind === 'separator') {
                return (
                  <div key={item.id} className="flex items-center justify-center py-1">
                    <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
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
                  className={`flex gap-2 ${isAssistant ? 'items-end justify-start' : 'items-center justify-end'}`}
                >
                  {isAssistant ? (
                    <div className="relative h-7 w-7 flex-shrink-0">
                      <Image
                        src="/brand/tab_cleria/cleria_color_logo.png"
                        alt="Cler IA"
                        fill
                        sizes="28px"
                        className="object-contain"
                      />
                    </div>
                  ) : null}

                  {isAssistant ? (
                    <div className="max-w-[84%] text-[12px] leading-[1.55] text-slate-700 sm:text-[13px]">
                      <div className={isErrorAssistant ? 'text-red-600' : 'text-gray-700'}>{m.content}</div>
                      {isErrorAssistant ? null : renderAssistantExtras(m)}
                    </div>
                  ) : (
                    <div className="flex max-w-[84%] flex-col items-end">
                      <div className={`relative w-full overflow-hidden rounded-[18px] border border-blue-700/20 bg-[linear-gradient(180deg,#1C63F2_0%,#0E4AD8_55%,#0A3AA6_100%)] px-3 py-1.5 text-[12px] leading-[1.5] text-white shadow-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-10px_30px_rgba(0,0,0,0.10),0_10px_30px_rgba(15,23,42,0.12)] sm:text-[13px] ${animatedMessageId === m.id ? 'animate-cleria-user-in' : ''}`}>
                        <div className="cler-ia-shimmer pointer-events-none absolute -left-1/2 top-[-35%] h-[170%] w-[120%] rotate-12 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.20)_18%,rgba(255,255,255,0.08)_40%,rgba(255,255,255,0)_60%)] opacity-70 blur-[0.2px]" />
                        <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[radial-gradient(120%_90%_at_25%_10%,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_55%)]" />
                        <span className={`relative z-10 ${m.clientStatus === 'cancelled' ? 'opacity-70' : ''}`}>{m.content}</span>
                      </div>
                      {m.clientStatus === 'cancelled' ? (
                        <div className="mt-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                          Mensaje cancelado
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}

            {isWaitingResponse ? (
              <div className="flex flex-col items-start gap-1.5">
                <div className="flex items-center justify-start gap-2">
                  <div className="relative h-7 w-7 flex-shrink-0">
                    <Image
                      src="/brand/tab_cleria/cleria_color_logo.png"
                      alt="Cler IA"
                      fill
                      sizes="28px"
                      className="object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-gray-600 sm:text-[13px]">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
                    <span>{waitingText || 'Dame un momento...'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelResponse}
                  className="ml-10 text-[11px] text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="mt-auto border-t border-gray-200 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="relative mx-auto w-full max-w-[700px]">
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-full z-20 mb-2 origin-bottom transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                suggestionsCollapsed ? 'translate-y-3 scale-[0.98] opacity-0' : 'translate-y-0 scale-100 opacity-100'
              }`}
            >
              <div className={`mx-auto w-full rounded-2xl border border-slate-200/90 bg-white/95 p-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-md ${suggestionsCollapsed ? '' : 'pointer-events-auto'}`}>
                <div className="text-[12px] font-semibold text-gray-900">¿Qué quieres saber sobre tus facturas?</div>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {emptySuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!isChatReady || isWaitingResponse}
                      onClick={() => {
                        setSuggestionsCollapsed(true);
                        void handleSend(s);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-slate-500" />
                        <div className="text-[10.5px] text-slate-800 sm:text-[11px]">{s}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-2 flex justify-center">
              <button
                type="button"
                onClick={() => setSuggestionsCollapsed((prev) => !prev)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[10.5px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ChevronUp className={`h-3.5 w-3.5 transition-transform duration-300 ${suggestionsCollapsed ? 'rotate-0' : 'rotate-180'}`} />
                {suggestionsCollapsed ? 'Mostrar sugerencias' : 'Ocultar sugerencias'}
              </button>
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
            className="mx-auto block w-full max-w-[700px] resize-none overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-[12px] leading-5 text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 sm:text-[13px]"
          />
          </div>
        </div>
        </div>
      </div>

      <style jsx>{`
        .cler-ia-shimmer {
          transform: translateX(-60%) rotate(12deg);
          animation: clerIaShimmer 6s ease-in-out infinite;
          will-change: transform;
        }

        .cler-ia-hero {
          will-change: transform, opacity, max-height;
        }

        .cler-ia-pill-wrap {
          position: relative;
          display: inline-flex;
          isolation: isolate;
        }

        .cler-ia-halo {
          position: absolute;
          inset: -14px -20px;
          border-radius: 9999px;
          opacity: 0.96;
          filter: blur(16px);
          transform-origin: center;
          pointer-events: none;
          mix-blend-mode: normal;
        }

        .cler-ia-halo-one {
          background:
            radial-gradient(60% 92% at 14% 48%, rgba(37, 99, 235, 0.42) 0%, rgba(37, 99, 235, 0.22) 40%, rgba(37, 99, 235, 0) 74%),
            radial-gradient(58% 88% at 88% 56%, rgba(56, 189, 248, 0.34) 0%, rgba(56, 189, 248, 0.16) 36%, rgba(56, 189, 248, 0) 72%);
          animation: cleriaHaloMorphA 6.7s ease-in-out infinite;
        }

        .cler-ia-halo-two {
          inset: -20px -28px;
          background:
            radial-gradient(52% 84% at 26% 22%, rgba(59, 130, 246, 0.28) 0%, rgba(59, 130, 246, 0.12) 40%, rgba(59, 130, 246, 0) 76%),
            radial-gradient(48% 82% at 80% 74%, rgba(96, 165, 250, 0.28) 0%, rgba(96, 165, 250, 0.12) 38%, rgba(96, 165, 250, 0) 75%);
          animation: cleriaHaloMorphB 9.4s ease-in-out infinite;
        }

        .cler-ia-halo-three {
          inset: -14px -18px;
          background:
            linear-gradient(120deg, rgba(59, 130, 246, 0.28), rgba(125, 211, 252, 0.16), rgba(37, 99, 235, 0.28));
          opacity: 0.75;
          filter: blur(22px);
          animation: cleriaHaloFlow 11.8s linear infinite;
        }

        .cler-ia-pill-liquid {
          background:
            radial-gradient(135% 130% at 16% 8%, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.22) 24%, rgba(255,255,255,0) 46%),
            radial-gradient(96% 138% at 86% 74%, rgba(96,165,250,0.24) 0%, rgba(59,130,246,0.12) 24%, rgba(59,130,246,0) 52%),
            linear-gradient(110deg, rgba(255,255,255,0.16), rgba(37,99,235,0.1), rgba(255,255,255,0.18));
          opacity: 0.98;
          animation:
            cleriaLiquidDrift 8.9s ease-in-out infinite,
            cleriaLiquidWander 13.7s ease-in-out infinite reverse;
        }

        .cler-ia-pill-liquid::before,
        .cler-ia-pill-liquid::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          opacity: 0.75;
        }

        .cler-ia-pill-liquid::before {
          background:
            radial-gradient(58% 74% at 24% 30%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 62%),
            radial-gradient(46% 68% at 74% 66%, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.04) 38%, rgba(59,130,246,0) 66%);
          animation: cleriaLiquidWander 17.2s ease-in-out infinite;
        }

        .cler-ia-pill-liquid::after {
          background:
            linear-gradient(135deg, rgba(255,255,255,0.08), rgba(125,211,252,0.1), rgba(37,99,235,0.04));
          mix-blend-mode: screen;
          animation: cleriaLiquidPulse 11.3s ease-in-out infinite;
        }

        .animate-cleria-sheet-in {
          animation: cleriaSheetIn 800ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
        }

        .animate-cleria-user-in {
          animation: cleriaUserIn 520ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform, opacity;
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

        @keyframes cleriaHaloMorphA {
          0% {
            transform: translate3d(-2px, 1px, 0) scale(0.98) rotate(-1deg);
            border-radius: 58% 42% 54% 46% / 48% 56% 44% 52%;
          }
          25% {
            transform: translate3d(10px, -8px, 0) scale(1.13) rotate(2deg);
            border-radius: 44% 56% 38% 62% / 58% 40% 60% 42%;
          }
          50% {
            transform: translate3d(17px, -12px, 0) scale(1.22) rotate(5deg);
            border-radius: 46% 54% 40% 60% / 60% 42% 58% 40%;
          }
          75% {
            transform: translate3d(6px, 8px, 0) scale(1.1) rotate(-3deg);
            border-radius: 62% 38% 56% 44% / 46% 60% 40% 54%;
          }
          100% {
            transform: translate3d(-2px, 1px, 0) scale(0.98) rotate(-1deg);
            border-radius: 58% 42% 54% 46% / 48% 56% 44% 52%;
          }
        }

        @keyframes cleriaHaloMorphB {
          0% {
            transform: translate3d(0, 0, 0) scale(0.96) rotate(1deg);
            border-radius: 52% 48% 62% 38% / 44% 54% 46% 56%;
          }
          25% {
            transform: translate3d(-11px, 7px, 0) scale(1.11) rotate(-2deg);
            border-radius: 38% 62% 44% 56% / 58% 40% 60% 42%;
          }
          50% {
            transform: translate3d(-18px, 12px, 0) scale(1.24) rotate(-5deg);
            border-radius: 40% 60% 46% 54% / 60% 42% 58% 40%;
          }
          75% {
            transform: translate3d(8px, -6px, 0) scale(1.08) rotate(3deg);
            border-radius: 56% 44% 60% 40% / 42% 58% 44% 56%;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(0.96) rotate(1deg);
            border-radius: 52% 48% 62% 38% / 44% 54% 46% 56%;
          }
        }

        @keyframes cleriaHaloFlow {
          0% {
            transform: translateX(-10%) translateY(3%) scaleX(0.9) scaleY(0.95) rotate(-2deg);
          }
          25% {
            transform: translateX(6%) translateY(-4%) scaleX(1.04) scaleY(1.02) rotate(1deg);
          }
          50% {
            transform: translateX(13%) translateY(-7%) scaleX(1.18) scaleY(1.08) rotate(4deg);
          }
          75% {
            transform: translateX(-3%) translateY(6%) scaleX(1.05) scaleY(1.03) rotate(-1deg);
          }
          100% {
            transform: translateX(-10%) translateY(3%) scaleX(0.9) scaleY(0.95) rotate(-2deg);
          }
        }

        @keyframes cleriaLiquidDrift {
          0% {
            transform: translate3d(-1.5%, 0.5%, 0) scale(0.985) rotate(-0.4deg);
            opacity: 0.82;
          }
          25% {
            transform: translate3d(3.4%, -2.4%, 0) scale(1.02) rotate(0.8deg);
            opacity: 0.92;
          }
          50% {
            transform: translate3d(7.8%, -4.6%, 0) scale(1.055) rotate(1.2deg);
            opacity: 1;
          }
          75% {
            transform: translate3d(2.8%, 2.2%, 0) scale(1.02) rotate(-1deg);
            opacity: 0.9;
          }
          100% {
            transform: translate3d(-1.5%, 0.5%, 0) scale(0.985) rotate(-0.4deg);
            opacity: 0.82;
          }
        }

        @keyframes cleriaLiquidWander {
          0% {
            transform: translate3d(0%, 0%, 0) scale(1);
          }
          20% {
            transform: translate3d(-3%, 1.8%, 0) scale(1.018);
          }
          40% {
            transform: translate3d(2.8%, -2.2%, 0) scale(0.996);
          }
          60% {
            transform: translate3d(4.2%, 1.6%, 0) scale(1.022);
          }
          80% {
            transform: translate3d(-2.4%, -1.4%, 0) scale(1.005);
          }
          100% {
            transform: translate3d(0%, 0%, 0) scale(1);
          }
        }

        @keyframes cleriaLiquidPulse {
          0% {
            opacity: 0.42;
            transform: scale(0.99);
          }
          50% {
            opacity: 0.78;
            transform: scale(1.02);
          }
          100% {
            opacity: 0.42;
            transform: scale(0.99);
          }
        }

        @keyframes cleriaUserIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cler-ia-shimmer {
            animation: none;
          }

          .cler-ia-hero {
            transition: none !important;
          }

          .animate-cleria-sheet-in {
            animation: none;
          }

          .cler-ia-halo,
          .cler-ia-pill-liquid,
          .animate-cleria-user-in {
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
