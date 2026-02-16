import { NextResponse } from 'next/server';
import type { PostgrestError } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const empresaIdRaw = (url.searchParams.get('empresa_id') ?? '49').trim();
  const tipo = (url.searchParams.get('tipo') ?? 'Gastos').trim();
  const source = (url.searchParams.get('source') ?? 'ocr').trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20), 1), 200);

  const empresaId = Number(empresaIdRaw);

  const select =
    'id, empresa_id, numero, fecha, tipo, source, seller_tax_id, buyer_tax_id, invoice_concept, importe_total, user_businessname, created_at';

  const { data: serverRows, error: serverError } = await supabase
    .schema('public')
    .from('facturas')
    .select(select)
    .eq('empresa_id', empresaId)
    .eq('tipo', tipo)
    .eq('source', source)
    .order('fecha', { ascending: false })
    .limit(limit);

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: adminRows, error: adminError } = await supabaseAdmin
    .from('facturas')
    .select(select)
    .eq('empresa_id', empresaId)
    .eq('tipo', tipo)
    .eq('source', source)
    .order('fecha', { ascending: false })
    .limit(limit);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email ?? null },
    filters: { empresa_id: empresaId, tipo, source, limit },
    server: {
      count: serverRows?.length ?? 0,
      error: serverError ? { message: serverError.message, code: (serverError as PostgrestError).code } : null,
      rows: serverRows ?? [],
    },
    admin: {
      count: adminRows?.length ?? 0,
      error: adminError ? { message: adminError.message, code: (adminError as PostgrestError).code } : null,
      rows: adminRows ?? [],
    },
  });
}
