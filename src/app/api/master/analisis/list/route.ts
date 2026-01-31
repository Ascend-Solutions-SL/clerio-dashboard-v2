import { NextRequest, NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { compareFacturas, computeStatus, type FacturaRow } from '@/lib/master/facturaComparison';

type ListRow = {
  factura_uid: string;
  status: 'ok' | 'warn' | 'bad' | 'missing';
  diffCount: number;
  totalFields: number;
  percentA: number | null;
  percentB: number | null;
  best: 'A' | 'B' | 'Igual' | null;
  bestPercent: number | null;
  numero: string;
  fecha: string;
  tipo: string;
  empresa_id: number | null;
  user_businessname: string | null;
  drive_file_id: string | null;
  missingSide?: 'A' | 'B';
};

type ListRowInternal = ListRow & {
  completeA: boolean;
  completeB: boolean;
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
  const onlyDiffs = (searchParams.get('onlyDiffs') ?? '').trim() === '1';
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: aRowsRaw, error: aError } = await supabaseAdmin
    .from('facturas')
    .select(
      'id, numero, fecha, tipo, empresa_id, cliente_proveedor, concepto, importe_sin_iva, iva, estado_pago, estado_proces, drive_file_id, drive_file_name, user_businessname, factura_uid, importe_total'
    )
    .order('id', { ascending: false })
    .limit(800);

  if (aError) {
    return NextResponse.json({ error: aError.message }, { status: 500 });
  }

  const { data: bRowsRaw, error: bError } = await supabaseAdmin
    .from('facturas_GAI')
    .select(
      'id, numero, fecha, tipo, empresa_id, cliente_proveedor, concepto, importe_sin_iva, iva, estado_pago, estado_proces, drive_file_id, drive_file_name, user_businessname, factura_uid, importe_total'
    )
    .order('id', { ascending: false })
    .limit(800);

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

  const uids = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));

  const { data: reviewRowsRaw, error: reviewError } = await supabaseAdmin
    .from('factura_comparison_reviews')
    .select('factura_uid, tool_a, tool_b')
    .in('factura_uid', uids);

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  const reviewMap = new Map<
    string,
    { toolA: Record<string, ValidationState>; toolB: Record<string, ValidationState> }
  >();

  for (const r of (reviewRowsRaw as unknown as { factura_uid?: unknown; tool_a?: unknown; tool_b?: unknown }[]) ?? []) {
    const factura_uid = typeof r.factura_uid === 'string' ? r.factura_uid : '';
    if (!factura_uid) {
      continue;
    }
    reviewMap.set(factura_uid, {
      toolA: sanitizeMap(r.tool_a),
      toolB: sanitizeMap(r.tool_b),
    });
  }

  let rows: ListRowInternal[] = uids.map((factura_uid) => {
    const a = mapA.get(factura_uid) ?? null;
    const b = mapB.get(factura_uid) ?? null;

    if (!a || !b) {
      const present = a ?? b;
      return {
        factura_uid,
        status: 'missing',
        diffCount: 0,
        totalFields: 0,
        percentA: null,
        percentB: null,
        best: null,
        bestPercent: null,
        completeA: false,
        completeB: false,
        numero: present?.numero ?? '',
        fecha: String(present?.fecha ?? ''),
        tipo: present?.tipo ?? '',
        empresa_id: present?.empresa_id ?? null,
        user_businessname: present?.user_businessname ?? null,
        drive_file_id: present?.drive_file_id ?? null,
        missingSide: a ? 'B' : 'A',
      };
    }

    const comparison = compareFacturas(factura_uid, a, b);
    const status = computeStatus(comparison);

    const totalFields = comparison.diffs.length;
    const fields = comparison.diffs.map((d) => d.field);
    const review = reviewMap.get(factura_uid) ?? null;
    const percentA = computePercent(fields, review?.toolA ?? null, totalFields);
    const percentB = computePercent(fields, review?.toolB ?? null, totalFields);
    const completeA = isCompleteReview(fields, review?.toolA ?? null);
    const completeB = isCompleteReview(fields, review?.toolB ?? null);
    const best =
      percentA === null || percentB === null
        ? null
        : Math.abs(percentA - percentB) < 0.00001
          ? 'Igual'
          : percentA > percentB
            ? 'A'
            : 'B';
    const bestPercent = best === null ? null : best === 'Igual' ? percentA : best === 'A' ? percentA : percentB;

    return {
      factura_uid,
      status,
      diffCount: comparison.diffCount,
      totalFields,
      percentA,
      percentB,
      best,
      bestPercent,
      completeA,
      completeB,
      numero: a.numero,
      fecha: String(a.fecha),
      tipo: a.tipo,
      empresa_id: a.empresa_id,
      user_businessname: a.user_businessname,
      drive_file_id: a.drive_file_id,
    };
  });

  if (q) {
    rows = rows.filter((r) => {
      const hay = [r.factura_uid, r.numero, r.tipo, r.user_businessname, r.empresa_id, r.fecha]
        .map((v) => normalize(v))
        .join(' ');
      return hay.includes(q);
    });
  }

  if (onlyDiffs) {
    rows = rows.filter((r) => r.status !== 'ok');
  }

  rows.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.diffCount - a.diffCount);

  const comparableA = rows.filter(
    (r) => r.status !== 'missing' && r.totalFields > 0 && r.completeA === true && r.percentA !== null
  );
  const comparableB = rows.filter(
    (r) => r.status !== 'missing' && r.totalFields > 0 && r.completeB === true && r.percentB !== null
  );

  const sumFieldsA = comparableA.reduce((acc, r) => acc + r.totalFields, 0);
  const sumFieldsB = comparableB.reduce((acc, r) => acc + r.totalFields, 0);

  const sumCorrectA = comparableA.reduce((acc, r) => acc + ((r.percentA as number) / 100) * r.totalFields, 0);
  const sumCorrectB = comparableB.reduce((acc, r) => acc + ((r.percentB as number) / 100) * r.totalFields, 0);

  const overallPercentA = sumFieldsA > 0 ? (sumCorrectA / sumFieldsA) * 100 : null;
  const overallPercentB = sumFieldsB > 0 ? (sumCorrectB / sumFieldsB) * 100 : null;

  const payloadRows: ListRow[] = rows.map(({ completeA: _a, completeB: _b, ...rest }) => rest);

  return NextResponse.json({ rows: payloadRows, overallPercentA, overallPercentB });
}
