import { NextRequest, NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { buildAutoSummary, compareFacturas, computeStatus, type FacturaRow, type FieldDiff, type ComparableFacturaField } from '@/lib/master/facturaComparison';

function deriveBuyerSeller(
  row: FacturaRow,
  cif: string
): { nombre_comprador: string; cif_comprador: string; nombre_vendedor: string; cif_vendedor: string } {
  const tipo = (row.tipo ?? '').trim().toLowerCase();
  if (tipo === 'gastos') {
    return {
      nombre_comprador: row.user_businessname ?? '',
      cif_comprador: cif,
      nombre_vendedor: row.cliente_proveedor ?? '',
      cif_vendedor: '11111111X',
    };
  }
  // Ingresos (or any other type)
  return {
    nombre_comprador: row.cliente_proveedor ?? '',
    cif_comprador: '11111111X',
    nombre_vendedor: row.user_businessname ?? '',
    cif_vendedor: cif,
  };
}

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

  // Look up CIF from auth_users by user_businessname
  const businessName = (a.user_businessname ?? b.user_businessname ?? '').trim();
  let cif = '';
  if (businessName) {
    const { data: authRow } = await supabaseAdmin
      .from('auth_users')
      .select('user_business_cif')
      .eq('user_businessname', businessName)
      .maybeSingle();
    cif = ((authRow as { user_business_cif?: string } | null)?.user_business_cif ?? '').trim();
  }

  // Derive buyer/seller fields for each side
  const derivedA = deriveBuyerSeller(a, cif);
  const derivedB = deriveBuyerSeller(b, cif);

  const DERIVED_FIELDS = ['nombre_comprador', 'cif_comprador', 'nombre_vendedor', 'cif_vendedor'] as const;
  const extraDiffs: FieldDiff[] = DERIVED_FIELDS.map((field) => {
    const av = derivedA[field];
    const bv = derivedB[field];
    const sa = String(av ?? '').trim().toLowerCase();
    const sb = String(bv ?? '').trim().toLowerCase();
    return {
      field: field as ComparableFacturaField,
      a: av,
      b: bv,
      equal: sa === sb,
      delta: null,
    };
  });

  comparison.diffs = [...comparison.diffs, ...extraDiffs];

  return NextResponse.json({ comparison, status, summary });
}
