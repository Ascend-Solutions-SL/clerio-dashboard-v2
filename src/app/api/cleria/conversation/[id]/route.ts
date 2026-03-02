import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const normalizeTitle = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return raw.slice(0, 60);
};

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await Promise.resolve(context.params);
  const conversationId = String(params?.id ?? '').trim();

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation id' }, { status: 400 });
  }

  const { data: conv, error: convError } = await supabase
    .schema('public')
    .from('cleria_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_uid', user.id)
    .maybeSingle();

  if (convError || !conv?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .schema('public')
    .from('cleria_messages')
    .select('id, role, content, type, metadata, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, context: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await Promise.resolve(context.params);
  const conversationId = String(params?.id ?? '').trim();
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation id' }, { status: 400 });
  }

  let body: { title?: string };
  try {
    body = (await request.json()) as { title?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const nextTitle = normalizeTitle(body?.title);
  if (!nextTitle) {
    return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
  }

  const { data: conv, error: convError } = await supabase
    .schema('public')
    .from('cleria_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_uid', user.id)
    .maybeSingle();

  if (convError || !conv?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .schema('public')
    .from('cleria_conversations')
    .update({ title: nextTitle, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update title' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, title: nextTitle });
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await Promise.resolve(context.params);
  const conversationId = String(params?.id ?? '').trim();
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation id' }, { status: 400 });
  }

  const { data: conv, error: convError } = await supabase
    .schema('public')
    .from('cleria_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_uid', user.id)
    .maybeSingle();

  if (convError || !conv?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: deleteMessagesError } = await supabase
    .schema('public')
    .from('cleria_messages')
    .delete()
    .eq('conversation_id', conversationId);

  if (deleteMessagesError) {
    return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
  }

  const { data: deletedConversation, error: deleteError } = await supabase
    .schema('public')
    .from('cleria_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_uid', user.id)
    .select('id')
    .maybeSingle();

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }

  if (!deletedConversation?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
