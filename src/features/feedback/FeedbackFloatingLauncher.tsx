'use client';

import * as React from 'react';
import { MessageCirclePlus } from 'lucide-react';

import { FeedbackComposerDialog } from '@/features/feedback/FeedbackComposerDialog';

export function FeedbackFloatingLauncher() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group fixed bottom-6 right-6 z-[80] inline-flex items-center gap-2 rounded-full border border-slate-200/85 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#eef2ff_100%)] px-4 py-3 text-sm font-medium text-slate-800 shadow-[0_14px_36px_rgba(15,23,42,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(15,23,42,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        aria-label="Abrir feedback"
      >
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.24),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(167,139,250,0.24),transparent_44%)] opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_8px_20px_rgba(15,23,42,0.35)]">
          <MessageCirclePlus className="h-4 w-4" />
        </span>
        <span className="relative hidden pr-1 sm:inline">Feedback</span>
      </button>

      <FeedbackComposerDialog open={open} onOpenChange={setOpen} startWithTypeSelection onSubmitted={() => {}} />
    </>
  );
}
