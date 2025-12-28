"use client";

import Image from 'next/image';
import React, { useEffect, useMemo, useRef, useState } from 'react';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '¡Hola! Soy Cler, ¿en qué puedo ayudarte?',
};

export default function ClerioChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setMessages([WELCOME_MESSAGE]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, 160);
    const finalHeight = Math.max(next, 44);
    el.style.height = `${finalHeight}px`;
  }, [draft]);

  const canSend = useMemo(() => draft.trim().length > 0, [draft]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        role: 'user',
        content: text,
      },
    ]);
    setDraft('');
  };

  return (
    <div className="mx-auto w-full max-w-3xl h-full flex flex-col pt-6">
      <div className="flex flex-col items-center text-center">
        <div className="relative h-14 w-14">
          <Image
            src="/brand/cleria_color_logo.png"
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
        <div className="flex-1 min-h-0 px-5 py-5 overflow-auto pr-2">
          <div className="space-y-4">
              {messages.map((m) => {
                const isAssistant = m.role === 'assistant';
                return (
                  <div
                    key={m.id}
                    className={`flex gap-3 items-center ${isAssistant ? 'justify-start' : 'justify-end'}`}
                  >
                    {isAssistant ? (
                      <div className="relative h-9 w-9 flex-shrink-0">
                        <Image
                          src="/brand/cleria_color_logo.png"
                          alt="Cler IA"
                          fill
                          sizes="36px"
                          className="object-contain"
                        />
                      </div>
                    ) : null}

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed border shadow-sm ${
                        isAssistant
                          ? 'relative overflow-hidden text-white border-blue-700/20 bg-[linear-gradient(180deg,#1C63F2_0%,#0E4AD8_55%,#0A3AA6_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-10px_30px_rgba(0,0,0,0.10),0_10px_30px_rgba(15,23,42,0.12)]'
                          : 'text-gray-900 border-gray-200 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.55)_28%,rgba(255,255,255,0.00)_60%),linear-gradient(135deg,#FFFFFF_0%,#F7FAFF_45%,#EEF2FF_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_30px_rgba(15,23,42,0.08)]'
                      }`}
                    >
                      {isAssistant ? (
                        <>
                          <div className="cler-ia-shimmer pointer-events-none absolute -left-1/2 top-[-35%] h-[170%] w-[120%] rotate-12 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.20)_18%,rgba(255,255,255,0.08)_40%,rgba(255,255,255,0)_60%)] opacity-70 blur-[0.2px]" />
                          <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[radial-gradient(120%_90%_at_25%_10%,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_55%)]" />
                          <span className="relative z-10">{m.content}</span>
                        </>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="mt-auto border-t border-gray-200 px-5 py-4">
          <div>
            <div>
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
                    handleSend();
                  }
                }}
                placeholder="Escribe un mensaje…"
                className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-5 text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 overflow-y-auto"
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
        }
      `}</style>
    </div>
  );
}
