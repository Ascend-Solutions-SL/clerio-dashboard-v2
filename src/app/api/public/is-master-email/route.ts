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

  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const emailRaw = typeof body.email === 'string' ? body.email : '';
  const email = emailRaw.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from('master_accounts')
    .select('id')
    .eq('master_email', email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, isMaster: !!data?.id });
}
