import { NextRequest, NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { buildAutoSummary, compareFacturas, computeStatus, type FacturaRow } from '@/lib/master/facturaComparison';

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
    'id, numero, fecha, tipo, empresa_id, cliente_proveedor, concepto, importe_sin_iva, iva, estado_pago, estado_proces, drive_file_id, drive_type, drive_file_name, user_businessname, factura_uid, importe_total';

  const [{ data: aRowRaw, error: aError }, { data: bRowRaw, error: bError }] = await Promise.all([
    supabaseAdmin.from('facturas').select(select).eq('factura_uid', facturaUid).maybeSingle(),
    supabaseAdmin.from('facturas_GAI').select(select).eq('factura_uid', facturaUid).maybeSingle(),
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

  const comparison = compareFacturas(facturaUid, a, b);
  const status = computeStatus(comparison);
  const summary = buildAutoSummary(comparison);

  return NextResponse.json({ comparison, status, summary });
}
