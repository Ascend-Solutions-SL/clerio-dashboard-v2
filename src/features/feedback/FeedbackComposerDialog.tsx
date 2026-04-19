'use client';

import * as React from 'react';
import { Bug, ImagePlus, Lightbulb, Sparkles, UploadCloud } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

import { FEEDBACK_TYPE_META, type FeedbackItem, type FeedbackType } from '@/features/feedback/types';

type ComposerStep = 'type' | 'form';

type FeedbackComposerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: FeedbackType | null;
  startWithTypeSelection?: boolean;
  onSubmitted?: (item: FeedbackItem) => void;
};

const TYPE_ICON: Record<FeedbackType, React.ReactNode> = {
  mejora: <Sparkles className="h-4 w-4" />,
  idea: <Lightbulb className="h-4 w-4" />,
  error: <Bug className="h-4 w-4" />,
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.max(1, Math.round(kb))} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
};

export function FeedbackComposerDialog({
  open,
  onOpenChange,
  initialType = null,
  startWithTypeSelection = false,
  onSubmitted,
}: FeedbackComposerDialogProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [step, setStep] = React.useState<ComposerStep>('form');
  const [selectedType, setSelectedType] = React.useState<FeedbackType>('mejora');
  const [isTypeLocked, setIsTypeLocked] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [attachment, setAttachment] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    if (initialType) {
      setSelectedType(initialType);
      setIsTypeLocked(true);
      setStep(startWithTypeSelection ? 'type' : 'form');
      return;
    }

    setSelectedType('mejora');
    setIsTypeLocked(false);
    setStep(startWithTypeSelection ? 'type' : 'form');
  }, [initialType, open, startWithTypeSelection]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const onPaste = (event: ClipboardEvent) => {
      if (!event.clipboardData) {
        return;
      }

      const items = Array.from(event.clipboardData.items);
      const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
      if (!imageItem) {
        return;
      }

      const file = imageItem.getAsFile();
      if (!file) {
        return;
      }

      const extension = file.type.split('/')[1] || 'png';
      const normalizedFile = new File([file], `feedback-paste-${Date.now()}.${extension}`, {
        type: file.type,
      });
      setAttachment(normalizedFile);
      toast({
        title: 'Captura pegada',
        description: 'La imagen se adjuntó al feedback.',
      });
    };

    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('paste', onPaste);
    };
  }, [open, toast]);

  const resetForm = React.useCallback(() => {
    setTitle('');
    setDescription('');
    setAttachment(null);
    setIsDragging(false);
    setIsSubmitting(false);
  }, []);

  const closeModal = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetForm();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetForm]
  );

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && !isSubmitting;
  const typeMeta = FEEDBACK_TYPE_META[selectedType];
  const hasLockedType = isTypeLocked || (startWithTypeSelection && step === 'form');

  const handleFile = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Formato no permitido',
        description: 'Solo se permiten imágenes para el adjunto.',
        variant: 'destructive',
      });
      return;
    }

    setAttachment(file);
  };

  const submitFeedback = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);

    const body = new FormData();
    body.append('type', selectedType);
    body.append('title', title.trim());
    body.append('description', description.trim());
    body.append('visibility', 'private');
    if (attachment) {
      body.append('attachment', attachment);
    }

    try {
      const response = await fetch('/api/feedback-items', {
        method: 'POST',
        credentials: 'include',
        body,
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; item?: FeedbackItem } | null;

      if (!response.ok || !payload?.item) {
        throw new Error(payload?.error ?? 'No se pudo enviar el feedback');
      }

      toast({
        title: 'Feedback enviado',
        description: 'Gracias por compartirlo con el equipo.',
      });

      onSubmitted?.(payload.item);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'No se pudo enviar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogContent
        className={`max-w-2xl rounded-2xl bg-white p-0 ${step === 'form' ? typeMeta.auraClass : 'border-slate-200 shadow-[0_35px_90px_rgba(15,23,42,0.22)]'}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0] ?? null;
          handleFile(file);
        }}
      >
        {step === 'type' ? (
          <div className="space-y-6 p-8 sm:p-10">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-slate-900">
                ¿Qué tipo de feedback quieres dar?
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Elige un tipo para abrir el formulario con contexto.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(FEEDBACK_TYPE_META) as FeedbackType[]).map((type) => {
                const meta = FEEDBACK_TYPE_META[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setSelectedType(type);
                      setIsTypeLocked(true);
                      setStep('form');
                    }}
                    className={`group rounded-2xl border px-4 py-5 text-left transition-all duration-200 hover:-translate-y-0.5 ${meta.surface} ${meta.hover}`}
                  >
                    <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-current/20 bg-white/75 text-current">
                      {TYPE_ICON[type]}
                    </span>
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="mt-1 text-xs text-current/70">Crear solicitud de {meta.shortLabel.toLowerCase()}.</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6 p-8 sm:p-10">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-slate-900">Nuevo feedback</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Comparte una mejora, idea o error. También puedes arrastrar o pegar una captura.
              </DialogDescription>
            </DialogHeader>

            {hasLockedType ? (
              <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${typeMeta.surface}`}>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-current/20 bg-white/75 text-current">
                  {TYPE_ICON[selectedType]}
                </span>
                Tipo seleccionado: {typeMeta.label}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {(Object.keys(FEEDBACK_TYPE_META) as FeedbackType[]).map((type) => {
                  const isActive = selectedType === type;
                  const meta = FEEDBACK_TYPE_META[type];

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedType(type)}
                      className={`rounded-xl border px-3 py-3 text-left transition-all duration-200 ${
                        isActive
                          ? `${meta.surface} shadow-[0_10px_28px_rgba(15,23,42,0.16)]`
                          : `border-slate-200 bg-white text-slate-700 ${meta.hover}`
                      }`}
                    >
                      <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-current/20 bg-white/75 text-current">
                        {TYPE_ICON[type]}
                      </span>
                      <p className="text-sm font-semibold">{meta.label}</p>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Título</label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Resume en una frase el feedback"
                  className="h-11 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-none focus-visible:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Descripción</label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Cuéntanos el contexto, el impacto y cómo te gustaría que funcionase"
                  className="min-h-[140px] rounded-xl border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-none focus-visible:ring-slate-300"
                />
              </div>

              <div
                className={`rounded-2xl border border-dashed px-4 py-5 transition-all duration-200 ${
                  isDragging ? 'border-slate-900 bg-slate-100/70' : 'border-slate-300 bg-slate-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                />

                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Subida de imagen</p>
                    <p className="text-xs text-slate-500">Arrastra, selecciona archivo o pega una captura (⌘/Ctrl + V).</p>
                    {attachment ? (
                      <p className="mt-1 text-xs text-slate-600">
                        {attachment.name} · {formatBytes(attachment.size)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {attachment ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-xl px-3 text-xs text-slate-600 hover:bg-slate-200"
                        onClick={() => setAttachment(null)}
                      >
                        Quitar
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-100"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      Seleccionar
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              {startWithTypeSelection ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 rounded-xl px-3 text-sm text-slate-500 hover:bg-slate-100"
                  onClick={() => {
                    setIsTypeLocked(false);
                    setStep('type');
                  }}
                >
                  Volver
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="button"
                onClick={() => void submitFeedback()}
                disabled={!canSubmit}
                className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:-translate-y-[1px] hover:bg-slate-800"
              >
                <ImagePlus className="h-4 w-4" />
                {isSubmitting ? 'Enviando…' : 'Enviar feedback'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
