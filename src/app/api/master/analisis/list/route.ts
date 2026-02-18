import { NextRequest, NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { FacturaRow } from '@/lib/master/facturaComparison';
import { MASTER_ANALYSIS_SCORING_FIELDS, MASTER_ANALYSIS_VISIBLE_FIELDS } from '@/lib/master/analysisFields';

type ListRow = {
  factura_uid: string;
  totalFields: number;
  percent: number | null;
  reviewedComplete: boolean;
  numero: string;
  fecha: string;
  tipo: string;
  buyer_name: string | null;
  buyer_tax_id: string | null;
  seller_name: string | null;
  seller_tax_id: string | null;
  empresa_id: number | null;
  user_businessname: string | null;
  drive_file_id: string | null;
  importe_total: number | null;
};

type ListRowInternal = ListRow & {
  hasReview: boolean;
};

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

type ValidationState = 'unset' | 'correct' | 'incorrect';

function isValidationState(value: unknown): value is ValidationState {
  return value === 'unset' || value === 'correct' || value === 'incorrect';
}

function sanitizeMap(value: unknown): Record<string, ValidationState> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const out: Record<string, ValidationState> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof k !== 'string') {
      continue;
    }
    if (isValidationState(v)) {
      out[k] = v;
    }
  }

  return out;
}

function computePercent(
  fields: string[],
  validation: Record<string, ValidationState> | null,
  totalFields: number
): number | null {
  if (!validation || totalFields <= 0) {
    return null;
  }

  let correct = 0;
  for (const f of fields) {
    if (validation[f] === 'correct') {
      correct += 1;
    }
  }

  return (correct / totalFields) * 100;
}

function isCompleteReview(fields: string[], validation: Record<string, ValidationState> | null): boolean {
  if (!validation) {
    return false;
  }

  for (const f of fields) {
    const v = validation[f] ?? 'unset';
    if (v === 'unset') {
      return false;
    }
  }

  return true;
}

export async function GET(request: NextRequest) {
  const guard = await requireMasterUser();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status });
  }

  const { searchParams } = request.nextUrl;
  const onlyNotPerfect = (searchParams.get('onlyDiffs') ?? '').trim() === '1';
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const supabaseAdmin = getSupabaseAdminClient();

  const select =
    'id, numero, fecha, tipo, empresa_id, buyer_name, buyer_tax_id, seller_name, seller_tax_id, invoice_concept, invoice_reason, importe_sin_iva, iva, drive_file_id, drive_file_name, user_businessname, factura_uid, importe_total';

  const { data: facturaRowsRaw, error: facturaError } = await supabaseAdmin
    .from('facturas')
    .select(select)
    .order('id', { ascending: false })
    .limit(800);

  if (facturaError) {
    return NextResponse.json({ error: facturaError.message }, { status: 500 });
  }

  const facturaRows = (facturaRowsRaw as unknown as FacturaRow[] | null) ?? [];

  const map = new Map<string, FacturaRow>();
  for (const row of facturaRows) {
    if (!row.factura_uid) {
      continue;
    }
    if (!map.has(row.factura_uid)) {
      map.set(row.factura_uid, row);
    }
  }

  const uids = Array.from(map.keys());

  const { data: reviewRowsRaw, error: reviewError } = await supabaseAdmin
    .from('factura_comparison_reviews')
    .select('factura_uid, tool_a, tool_b')
    .in('factura_uid', uids);

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  const reviewMap = new Map<string, { toolA: Record<string, ValidationState> }>();

  for (const r of (reviewRowsRaw as unknown as { factura_uid?: unknown; tool_a?: unknown; tool_b?: unknown }[]) ?? []) {
    const factura_uid = typeof r.factura_uid === 'string' ? r.factura_uid : '';
    if (!factura_uid) {
      continue;
    }
    reviewMap.set(factura_uid, {
      toolA: sanitizeMap(r.tool_a),
    });
  }

  const scoringFields = MASTER_ANALYSIS_SCORING_FIELDS as readonly string[];
  const totalFields = scoringFields.length;

  let rows: ListRowInternal[] = uids.map((factura_uid) => {
    const row = map.get(factura_uid) ?? null;
    const review = reviewMap.get(factura_uid) ?? null;
    const percent = computePercent(scoringFields as unknown as string[], review?.toolA ?? null, totalFields);
    const reviewedComplete = isCompleteReview(scoringFields as unknown as string[], review?.toolA ?? null);
    const hasReview = review !== null;

    return {
      factura_uid,
      totalFields,
      percent,
      reviewedComplete,
      hasReview,
      numero: row?.numero ?? '',
      fecha: row?.fecha ? String(row.fecha) : '',
      tipo: row?.tipo ?? '',
      buyer_name: row?.buyer_name ?? null,
      buyer_tax_id: row?.buyer_tax_id ?? null,
      seller_name: row?.seller_name ?? null,
      seller_tax_id: row?.seller_tax_id ?? null,
      empresa_id: row?.empresa_id ?? null,
      user_businessname: row?.user_businessname ?? null,
      drive_file_id: row?.drive_file_id ?? null,
      importe_total: row?.importe_total ?? null,
    };
  });

  if (q) {
    rows = rows.filter((r) => {
      const hay = [
        r.factura_uid,
        r.numero,
        r.tipo,
        r.user_businessname,
        r.empresa_id,
        r.fecha,
        r.buyer_name,
        r.buyer_tax_id,
        r.seller_name,
        r.seller_tax_id,
      ]
        .map((v) => normalize(v))
        .join(' ');
      return hay.includes(q);
    });
  }

  if (onlyNotPerfect) {
    rows = rows.filter((r) => r.reviewedComplete === false || (r.percent ?? 0) < 99.999);
  }

  rows.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || (b.percent ?? -1) - (a.percent ?? -1));

  const comparable = rows.filter((r) => r.totalFields > 0 && r.reviewedComplete === true && r.percent !== null);
  const sumFields = comparable.reduce((acc, r) => acc + r.totalFields, 0);
  const sumCorrect = comparable.reduce((acc, r) => acc + ((r.percent as number) / 100) * r.totalFields, 0);
  const overallPercent = sumFields > 0 ? (sumCorrect / sumFields) * 100 : null;

  const payloadRows: ListRow[] = rows.map(({ hasReview: _hr, ...rest }) => rest);

  return NextResponse.json({ rows: payloadRows, overallPercent });
}
