import { NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import {
  COMPARABLE_FACTURA_FIELDS,
  compareFacturas,
  type ComparableFacturaField,
  type FacturaRow,
} from '@/lib/master/facturaComparison';

type FieldMetric = {
  field: ComparableFacturaField;
  matchCount: number;
  diffCount: number;
  total: number;
  matchPct: number;
};

type Totals = {
  totalPairs: number;
  ok: number;
  warn: number;
  bad: number;
};

export async function GET() {
  const guard = await requireMasterUser();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const select =
    'id, numero, fecha, tipo, empresa_id, cliente_proveedor, concepto, importe_sin_iva, iva, estado_pago, estado_proces, drive_file_id, drive_file_name, user_businessname, factura_uid, importe_total';

  const [{ data: aRowsRaw, error: aError }, { data: bRowsRaw, error: bError }] = await Promise.all([
    supabaseAdmin.from('facturas').select(select).limit(1500),
    supabaseAdmin.from('facturas_GAI').select(select).limit(1500),
  ]);

  if (aError) {
    return NextResponse.json({ error: aError.message }, { status: 500 });
  }

  if (bError) {
    return NextResponse.json({ error: bError.message }, { status: 500 });
  }

  const aRows = (aRowsRaw as unknown as FacturaRow[] | null) ?? [];
  const bRows = (bRowsRaw as unknown as FacturaRow[] | null) ?? [];

  const mapA = new Map<string, FacturaRow>();
  const mapB = new Map<string, FacturaRow>();

  for (const row of aRows) {
    if (!row.factura_uid) {
      continue;
    }
    mapA.set(row.factura_uid, row);
  }

  for (const row of bRows) {
    if (!row.factura_uid) {
      continue;
    }
    mapB.set(row.factura_uid, row);
  }

  const uids = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).filter((uid) => mapA.has(uid) && mapB.has(uid));

  const fieldCounts = Object.fromEntries(
    COMPARABLE_FACTURA_FIELDS.map((f) => [f, { match: 0, diff: 0 }])
  ) as Record<ComparableFacturaField, { match: number; diff: number }>;

  const totals: Totals = { totalPairs: 0, ok: 0, warn: 0, bad: 0 };

  for (const uid of uids) {
    const a = mapA.get(uid);
    const b = mapB.get(uid);
    if (!a || !b) {
      continue;
    }

    const comparison = compareFacturas(uid, a, b);
    totals.totalPairs += 1;

    if (comparison.diffCount === 0) {
      totals.ok += 1;
    } else if (comparison.hasTotalDiff || comparison.diffCount >= 4) {
      totals.bad += 1;
    } else {
      totals.warn += 1;
    }

    for (const d of comparison.diffs) {
      if (d.equal) {
        fieldCounts[d.field].match += 1;
      } else {
        fieldCounts[d.field].diff += 1;
      }
    }
  }

  const fields: FieldMetric[] = COMPARABLE_FACTURA_FIELDS.map((field) => {
    const matchCount = fieldCounts[field].match;
    const diffCount = fieldCounts[field].diff;
    const total = matchCount + diffCount;
    const matchPct = total > 0 ? (matchCount / total) * 100 : 0;
    return { field, matchCount, diffCount, total, matchPct };
  }).sort((a, b) => a.matchPct - b.matchPct);

  return NextResponse.json({ totals, fields });
}
