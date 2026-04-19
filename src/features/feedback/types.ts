export type FeedbackType = 'mejora' | 'idea' | 'error';

export type FeedbackStatus = 'enviado' | 'en_revision' | 'planificado' | 'en_progreso' | 'implementado' | 'rechazado';

export type FeedbackStatusHistory = Record<string, FeedbackStatus>;

export type FeedbackVisibility = 'private' | 'public';

export type FeedbackItem = {
  id: string;
  user_id: string;
  creator_display_name?: string;
  creator_initials?: string;
  participant_initials?: string[];
  title: string;
  description: string;
  type: FeedbackType;
  status: FeedbackStatus;
  visibility: FeedbackVisibility;
  is_primary: boolean;
  parent_id: string | null;
  duplicate_count: number;
  attachment_url: string | null;
  historico_data?: FeedbackStatusHistory | null;
  created_at: string;
};

export type FeedbackMessage = {
  id: string;
  feedback_id: string;
  sender_id: string;
  sender_display_name: string;
  sender_initials: string;
  message: string;
  attachments: string[];
  created_at: string;
};

export const FEEDBACK_TYPE_META: Record<
  FeedbackType,
  {
    label: string;
    shortLabel: string;
    tone: string;
    surface: string;
    hover: string;
    auraClass: string;
  }
> = {
  mejora: {
    label: 'Mejora',
    shortLabel: 'Mejora',
    tone: 'bg-sky-50 text-sky-700 border-sky-200',
    surface: 'border-sky-200 bg-sky-50/55 text-sky-900',
    hover: 'hover:border-sky-300 hover:bg-sky-100/65',
    auraClass: 'border-sky-200/90 shadow-[0_35px_95px_rgba(14,165,233,0.20)]',
  },
  idea: {
    label: 'Nueva Idea',
    shortLabel: 'Idea',
    tone: 'bg-violet-50 text-violet-700 border-violet-200',
    surface: 'border-violet-200 bg-violet-50/55 text-violet-900',
    hover: 'hover:border-violet-300 hover:bg-violet-100/65',
    auraClass: 'border-violet-200/90 shadow-[0_35px_95px_rgba(139,92,246,0.20)]',
  },
  error: {
    label: 'Error',
    shortLabel: 'Error',
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
    surface: 'border-rose-200 bg-rose-50/55 text-rose-900',
    hover: 'hover:border-rose-300 hover:bg-rose-100/65',
    auraClass: 'border-rose-200/90 shadow-[0_35px_95px_rgba(244,63,94,0.20)]',
  },
};

export const FEEDBACK_STATUS_COLUMNS: Array<{ id: FeedbackStatus; label: string }> = [
  { id: 'enviado', label: 'Enviado' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'planificado', label: 'Planificado' },
  { id: 'en_progreso', label: 'En progreso' },
  { id: 'implementado', label: 'Implementado' },
  { id: 'rechazado', label: 'Rechazado' },
];

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  enviado: 'Enviado',
  en_revision: 'En revisión',
  planificado: 'Planificado',
  en_progreso: 'En progreso',
  implementado: 'Implementado',
  rechazado: 'Rechazado',
};
