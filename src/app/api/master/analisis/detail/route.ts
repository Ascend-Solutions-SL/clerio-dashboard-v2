import { NextRequest, NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { FacturaRow } from '@/lib/master/facturaComparison';

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
    'id, numero, fecha, tipo, empresa_id, buyer_name, buyer_tax_id, seller_name, seller_tax_id, invoice_concept, invoice_reason, importe_sin_iva, iva, drive_file_id, drive_type, drive_file_name, user_businessname, factura_uid, importe_total';

  const { data, error } = await supabaseAdmin
    .from('facturas')
    .select(select)
    .eq('factura_uid', facturaUid)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const factura = (data as unknown as FacturaRow | null) ?? null;
  if (!factura) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ factura_uid: facturaUid, factura });
}
