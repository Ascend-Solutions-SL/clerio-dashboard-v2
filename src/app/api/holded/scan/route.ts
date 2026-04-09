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

const parseJsonSafely = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const resolveSource = (emailType: string | null) => {
  const normalized = (emailType ?? '').trim().toLowerCase();
  if (normalized === 'gmail') return 'googledrive';
  if (normalized === 'outlook') return 'onedrive';
  return '-';
};

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
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
  const userJwt = session?.access_token ?? null;

  const webhookResponse = await fetch(HOLDED_SCAN_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userJwt ? { Authorization: `Bearer ${userJwt}` } : {}),
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
    const upstreamText = (await webhookResponse.text()).trim();
    const upstreamPreview = upstreamText.length > 320 ? `${upstreamText.slice(0, 320)}...` : upstreamText;

    return NextResponse.json(
      {
        error: `Webhook respondió con ${webhookResponse.status}`,
        upstream_error: upstreamPreview || null,
      },
      { status: 502 }
    );
  }

  const rawBody = await webhookResponse.text();
  const parsedBody = parseJsonSafely(rawBody.trim());
  const normalizedBody =
    typeof parsedBody === 'string'
      ? parseJsonSafely(parsedBody)
      : parsedBody;

  const payload = normalizedBody && typeof normalizedBody === 'object'
    ? (normalizedBody as { run_id?: unknown; user_uid?: unknown; scan_type?: unknown })
    : null;

  const runId = typeof payload?.run_id === 'string' && payload.run_id.trim().length > 0
    ? payload.run_id.trim()
    : null;
  const userUid = typeof payload?.user_uid === 'string' && payload.user_uid.trim().length > 0
    ? payload.user_uid.trim()
    : user.id;
  const scanType = typeof payload?.scan_type === 'string' && payload.scan_type.trim().length > 0
    ? payload.scan_type.trim().toLowerCase()
    : 'holded';

  return NextResponse.json({
    ok: true,
    run_id: runId,
    user_uid: userUid,
    scan_type: scanType,
  });
}
