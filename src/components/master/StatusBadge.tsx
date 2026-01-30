'use client';

export default function StatusBadge({ status }: { status: 'ok' | 'warn' | 'bad' | 'missing' }) {
  const styles =
    status === 'ok'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : status === 'warn'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : status === 'bad'
          ? 'bg-red-50 text-red-800 border-red-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';

  const label =
    status === 'ok' ? 'OK' : status === 'warn' ? 'Revisar' : status === 'bad' ? 'Error' : 'Falta lado';

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}>{label}</span>
  );
}
