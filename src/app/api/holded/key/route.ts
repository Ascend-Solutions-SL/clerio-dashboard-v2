import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type HoldedApiKeyRow = {
  holded_apikey: string | null;
};

type AuthUserEmpresaRow = {
  empresa_id: number | null;
};

const maskApiKey = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= 8) {
    return trimmed;
  }

  const hiddenLength = trimmed.length - 8;
  return `${trimmed.slice(0, 4)}${'●'.repeat(hiddenLength)}${trimmed.slice(-4)}`;
};

export async function GET() {
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
    .select('empresa_id')
    .eq('user_uid', user.id)
    .maybeSingle();

  if (authUserError) {
    return NextResponse.json({ error: authUserError.message }, { status: 500 });
  }

  const empresaId = ((authUser as AuthUserEmpresaRow | null)?.empresa_id ?? null) as number | null;

  if (!empresaId) {
    return NextResponse.json({ connected: false, masked_api_key: null });
  }

  const { data, error } = await supabaseAdmin
    .from('holded_api_keys')
    .select('holded_apikey')
    .eq('user_uid', user.id)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = (data as HoldedApiKeyRow | null) ?? null;
  const apiKey = row?.holded_apikey?.trim() || '';

  return NextResponse.json({
    connected: Boolean(apiKey),
    masked_api_key: apiKey ? maskApiKey(apiKey) : null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { api_key?: unknown };
  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';

  if (!apiKey) {
    return NextResponse.json({ error: 'api_key es obligatoria' }, { status: 400 });
  }

  const { data: authUser, error: authUserError } = await supabaseAdmin
    .from('auth_users')
    .select('empresa_id')
    .eq('user_uid', user.id)
    .maybeSingle();

  if (authUserError) {
    return NextResponse.json({ error: authUserError.message }, { status: 500 });
  }

  const empresaId = ((authUser as AuthUserEmpresaRow | null)?.empresa_id ?? null) as number | null;
  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id no disponible para este usuario' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('holded_api_keys')
    .upsert({ user_uid: user.id, empresa_id: empresaId, holded_apikey: apiKey }, { onConflict: 'user_uid,empresa_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    connected: true,
    masked_api_key: maskApiKey(apiKey),
  });
}

export async function DELETE() {
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
    .select('empresa_id')
    .eq('user_uid', user.id)
    .maybeSingle();

  if (authUserError) {
    return NextResponse.json({ error: authUserError.message }, { status: 500 });
  }

  const empresaId = ((authUser as AuthUserEmpresaRow | null)?.empresa_id ?? null) as number | null;

  if (!empresaId) {
    return NextResponse.json({ ok: true, connected: false });
  }

  const { error } = await supabaseAdmin
    .from('holded_api_keys')
    .delete()
    .eq('user_uid', user.id)
    .eq('empresa_id', empresaId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, connected: false });
}
