import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type AuthUserRow = {
  email_type: string | null;
  user_business_cif: string | null;
  user_businessname: string | null;
  empresa_id: number | null;
};

type HoldedApiKeyRow = {
  holded_apikey: string | null;
};

const HOLDED_SCAN_WEBHOOK_URL = 'https://v-ascendsolutions.app.n8n.cloud/webhook/escanear-holded';

const resolveSource = (emailType: string | null) => {
  const normalized = (emailType ?? '').trim().toLowerCase();
  if (normalized === 'gmail') return 'googledrive';
  if (normalized === 'outlook') return 'onedrive';
  return '-';
};

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: authUser, error: authUserError } = await supabaseAdmin
    .from('auth_users')
    .select('email_type, user_business_cif, user_businessname, empresa_id')
    .eq('user_uid', user.id)
    .maybeSingle();

  if (authUserError) {
    return NextResponse.json({ error: authUserError.message }, { status: 500 });
  }

  const profile = (authUser as AuthUserRow | null) ?? null;

  const empresaId = profile?.empresa_id ?? null;
  const empresa = (profile?.user_businessname ?? '').trim();
  const cif = (profile?.user_business_cif ?? '').trim();
  const source = resolveSource(profile?.email_type ?? null);

  if (!empresaId || !empresa || !cif) {
    return NextResponse.json(
      { error: 'Faltan datos de empresa: empresa_id, nombre de empresa o CIF' },
      { status: 400 }
    );
  }

  const { data: holdedApiKeyRow, error: holdedApiKeyError } = await supabaseAdmin
    .from('holded_api_keys')
    .select('holded_apikey')
    .eq('user_uid', user.id)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (holdedApiKeyError) {
    return NextResponse.json({ error: holdedApiKeyError.message }, { status: 500 });
  }

  const holdedRow = (holdedApiKeyRow as HoldedApiKeyRow | null) ?? null;
  const holdedApiKey = (holdedRow?.holded_apikey ?? '').trim() || '-';

  const webhookResponse = await fetch(HOLDED_SCAN_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_uid: user.id,
      empresa_id: empresaId,
      empresa,
      cif,
      source,
      holded_apikey: holdedApiKey,
    }),
  });

  if (!webhookResponse.ok) {
    return NextResponse.json({ error: `Webhook respondió con ${webhookResponse.status}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
