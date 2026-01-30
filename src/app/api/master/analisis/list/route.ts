import { NextRequest, NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { compareFacturas, computeStatus, type FacturaRow } from '@/lib/master/facturaComparison';

type ListRow = {
  factura_uid: string;
  status: 'ok' | 'warn' | 'bad' | 'missing';
  diffCount: number;
  numero: string;
  fecha: string;
  tipo: string;
  empresa_id: number | null;
  user_businessname: string | null;
  drive_file_id: string | null;
  importe_total_a: number | null;
  importe_total_b: number | null;
  delta_importe_total: number | null;
  missingSide?: 'A' | 'B';
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

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

  let rows: ListRow[] = uids.map((factura_uid) => {
    const a = mapA.get(factura_uid) ?? null;
    const b = mapB.get(factura_uid) ?? null;

    if (!a || !b) {
      const present = a ?? b;
      return {
        factura_uid,
        status: 'missing',
        diffCount: 0,
        numero: present?.numero ?? '',
        fecha: String(present?.fecha ?? ''),
        tipo: present?.tipo ?? '',
        empresa_id: present?.empresa_id ?? null,
        user_businessname: present?.user_businessname ?? null,
        drive_file_id: present?.drive_file_id ?? null,
        importe_total_a: a?.importe_total ?? null,
        importe_total_b: b?.importe_total ?? null,
        delta_importe_total:
          toNumber(b?.importe_total) !== null && toNumber(a?.importe_total) !== null
            ? (toNumber(b?.importe_total) as number) - (toNumber(a?.importe_total) as number)
            : null,
        missingSide: a ? 'B' : 'A',
      };
    }

    const comparison = compareFacturas(factura_uid, a, b);
    const status = computeStatus(comparison);

    const totalA = toNumber(a.importe_total);
    const totalB = toNumber(b.importe_total);

    return {
      factura_uid,
      status,
      diffCount: comparison.diffCount,
      numero: a.numero,
      fecha: String(a.fecha),
      tipo: a.tipo,
      empresa_id: a.empresa_id,
      user_businessname: a.user_businessname,
      drive_file_id: a.drive_file_id,
      importe_total_a: totalA,
      importe_total_b: totalB,
      delta_importe_total: totalA !== null && totalB !== null ? totalB - totalA : null,
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

  return NextResponse.json({ rows });
}
