import { NextRequest, NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { buildAutoSummary, compareFacturas, computeStatus, type FacturaRow } from '@/lib/master/facturaComparison';

const DETAIL_VISIBLE_FIELDS = [
  'numero',
  'tipo',
  'buyer_name',
  'buyer_tax_id',
  'seller_name',
  'seller_tax_id',
  'iva',
  'importe_sin_iva',
  'importe_total',
  'fecha',
  'invoice_concept',
  'invoice_reason',
  'user_businessname',
] as const;

const DETAIL_SCORING_FIELDS = DETAIL_VISIBLE_FIELDS.filter(
  (f) => f !== 'invoice_concept' && f !== 'invoice_reason'
) as readonly string[];

export async function GET(request: NextRequest) {
  const guard = await requireMasterUser();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status });
  }

  const facturaUid = (request.nextUrl.searchParams.get('factura_uid') ?? '').trim();
  if (!facturaUid) {
    return NextResponse.json({ error: 'Missing factura_uid' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const select =
    'id, numero, fecha, tipo, empresa_id, source, buyer_name, buyer_tax_id, seller_name, seller_tax_id, invoice_concept, invoice_reason, importe_sin_iva, iva, drive_file_id, drive_type, drive_file_name, user_businessname, factura_uid, importe_total';

  const [{ data: aRowRaw, error: aError }, { data: bRowRaw, error: bError }] = await Promise.all([
    supabaseAdmin.from('facturas').select(select).eq('factura_uid', facturaUid).eq('source', 'ocr').maybeSingle(),
    supabaseAdmin.from('facturas').select(select).eq('factura_uid', facturaUid).eq('source', 'gai').maybeSingle(),
  ]);

  if (aError) {
    return NextResponse.json({ error: aError.message }, { status: 500 });
  }

  if (bError) {
    return NextResponse.json({ error: bError.message }, { status: 500 });
  }

  const a = (aRowRaw as unknown as FacturaRow | null) ?? null;
  const b = (bRowRaw as unknown as FacturaRow | null) ?? null;

  if (!a || !b) {
    return NextResponse.json(
      {
        factura_uid: facturaUid,
        a,
        b,
        missingSide: a ? 'B' : 'A',
      },
      { status: 200 }
    );
  }

  const comparisonRaw = compareFacturas(facturaUid, a, b);
  const visibleDiffs = comparisonRaw.diffs.filter((d) => (DETAIL_VISIBLE_FIELDS as readonly string[]).includes(d.field));

  const scoringDiffs = visibleDiffs.filter((d) => (DETAIL_SCORING_FIELDS as readonly string[]).includes(d.field));
  const diffCount = scoringDiffs.filter((d) => !d.equal).length;
  const hasTotalDiff = scoringDiffs.some((d) => d.field === 'importe_total' && !d.equal);

  const comparison = {
    ...comparisonRaw,
    diffs: visibleDiffs,
    diffCount,
    hasDiffs: diffCount > 0,
    hasTotalDiff,
  };

  const scoringComparison = {
    ...comparison,
    diffs: scoringDiffs,
    diffCount,
    hasDiffs: diffCount > 0,
    hasTotalDiff,
  };

  const status = computeStatus(scoringComparison);
  const summary = buildAutoSummary(scoringComparison);

  return NextResponse.json({ comparison, status, summary });
}
