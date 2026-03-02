import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { user_uid?: string; empresa_id?: number };
  try {
    body = (await request.json()) as { user_uid?: string; empresa_id?: number };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (body.user_uid && String(body.user_uid) !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .schema('public')
    .from('auth_users')
    .select('empresa_id')
    .eq('user_uid', user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }

  const empresaId = profile?.empresa_id ?? null;
  if (empresaId == null) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (body.empresa_id != null && Number(body.empresa_id) !== empresaId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: inserted, error } = await supabase
    .schema('public')
    .from('cleria_conversations')
    .insert({ user_uid: user.id, empresa_id: empresaId, title: 'Nuevo Chat' })
    .select('id')
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id });
}
