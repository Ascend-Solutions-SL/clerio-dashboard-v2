import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { ENV, assertEnv } from '@/lib/config';

const createSupabaseAdminClient = () => {
  const url = ENV.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son necesarias');
  }

  return createClient(url, serviceKey);
};

export async function POST(request: NextRequest) {
  assertEnv();

  const body = (await request.json().catch(() => ({}))) as { cif?: unknown };
  const cifRaw = typeof body.cif === 'string' ? body.cif : '';
  const cif = cifRaw.trim();

  if (!cif) {
    return NextResponse.json({ error: 'missing_cif' }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: empresaRow, error: empresaError } = await supabaseAdmin
    .from('empresas')
    .select('id')
    .ilike('cif', cif)
    .maybeSingle();

  if (empresaError) {
    return NextResponse.json({ error: empresaError.message }, { status: 500 });
  }

  if (empresaRow?.id) {
    return NextResponse.json({ error: 'cif_taken' }, { status: 409 });
  }

  const { data: authUserRow, error: authUserError } = await supabaseAdmin
    .from('auth_users')
    .select('user_uid')
    .ilike('user_business_cif', cif)
    .maybeSingle();

  if (authUserError) {
    return NextResponse.json({ error: authUserError.message }, { status: 500 });
  }

  if (authUserRow?.user_uid) {
    return NextResponse.json({ error: 'cif_taken' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, available: true });
}
