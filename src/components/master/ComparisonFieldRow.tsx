'use client';

import TruncateWithTooltip from '@/components/TruncateWithTooltip';

export default function ComparisonFieldRow({
  field,
  a,
  b,
  equal,
}: {
  field: string;
  a: string;
  b: string;
  equal: boolean;
}) {
  return (
    <tr className={`border-t border-slate-100 ${equal ? '' : 'bg-orange-100/70'}`}>
      <td className="w-[22%] px-4 py-3 text-xs font-semibold text-slate-700">
        <TruncateWithTooltip value={field} />
      </td>
      <td className="w-[34%] px-4 py-3">
        <TruncateWithTooltip value={a} className={equal ? '' : 'text-slate-900'} />
      </td>
      <td className="w-[34%] px-4 py-3">
        <TruncateWithTooltip value={b} className={equal ? '' : 'text-slate-900'} />
      </td>
    </tr>
  );
}
