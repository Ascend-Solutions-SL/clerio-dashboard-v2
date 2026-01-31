'use client';

import TruncateWithTooltip from '@/components/TruncateWithTooltip';

export type ValidationState = 'unset' | 'correct' | 'incorrect';

function nextState(state: ValidationState): ValidationState {
  if (state === 'unset') {
    return 'correct';
  }

  if (state === 'correct') {
    return 'incorrect';
  }

  return 'unset';
}

function ValidationToggle({
  state,
  onChange,
  ariaLabel,
}: {
  state: ValidationState;
  onChange: (state: ValidationState) => void;
  ariaLabel: string;
}) {
  const styles =
    state === 'correct'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
      : state === 'incorrect'
        ? 'border-red-300 bg-red-50 text-red-700'
        : 'border-slate-300 bg-white text-transparent hover:bg-slate-50';

  const glyph = state === 'correct' ? '✓' : state === 'incorrect' ? '✕' : '•';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => onChange(nextState(state))}
      className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-md border text-[12px] font-bold leading-none ${styles}`}
    >
      {glyph}
    </button>
  );
}

export default function ComparisonFieldRow({
  field,
  a,
  b,
  equal,
  aState,
  bState,
  onChangeA,
  onChangeB,
}: {
  field: string;
  a: string;
  b: string;
  equal: boolean;
  aState: ValidationState;
  bState: ValidationState;
  onChangeA: (state: ValidationState) => void;
  onChangeB: (state: ValidationState) => void;
}) {
  return (
    <tr className={`border-t border-slate-100 ${equal ? '' : 'bg-orange-100/70'}`}>
      <td className="w-[22%] px-4 py-3 text-xs font-semibold text-slate-700">
        <TruncateWithTooltip value={field} />
      </td>
      <td className="w-[34%] px-4 py-3">
        <div className="flex items-start gap-2">
          <ValidationToggle state={aState} onChange={onChangeA} ariaLabel={`Validación Herramienta A para ${field}`} />
          <div className="min-w-0 flex-1">
            <TruncateWithTooltip value={a} className={equal ? '' : 'text-slate-900'} />
          </div>
        </div>
      </td>
      <td className="w-[34%] px-4 py-3">
        <div className="flex items-start gap-2">
          <ValidationToggle state={bState} onChange={onChangeB} ariaLabel={`Validación Herramienta B para ${field}`} />
          <div className="min-w-0 flex-1">
            <TruncateWithTooltip value={b} className={equal ? '' : 'text-slate-900'} />
          </div>
        </div>
      </td>
    </tr>
  );
}
