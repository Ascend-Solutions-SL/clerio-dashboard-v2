import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

type Body = {
  conversation_id: string;
  user_uid: string;
  empresa_id: number | string | null;
  message: string;
};

async function generateTitleFromMessage(message: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = `Genera un título corto (máximo 6 palabras) para esta conversación sobre facturación:\n\n"${message}"\n\nDevuelve solo el título sin comillas ni texto adicional.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 30,
    }),
  });

  if (!res.ok) {
    return null;
  }

  const json = (await res.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: unknown } }> }
    | null;
  const text = String(json?.choices?.[0]?.message?.content ?? '').trim();
  if (!text) {
    return null;
  }

  const cleaned = text.replace(/^"|"$/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const title = words.slice(0, 6).join(' ').trim();
  if (!title) {
    return null;
  }

  return title.slice(0, 60);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const isDev = process.env.NODE_ENV !== 'production';

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const conversationId = String(body?.conversation_id ?? '').trim();
  const userUid = String(body?.user_uid ?? '').trim();
  const requestedEmpresaIdRaw = body?.empresa_id;
  const message = String(body?.message ?? '').trim();

  if (!conversationId || !userUid || !message || requestedEmpresaIdRaw == null || `${requestedEmpresaIdRaw}`.trim() === '') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (userUid !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: profile, error: profileError } = await supabase
    .schema('public')
    .from('auth_users')
    .select('empresa_id')
    .eq('user_uid', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('cleria/message: failed to load profile', profileError);
    return NextResponse.json(
      { error: 'Failed to load profile', detail: isDev ? profileError.message : undefined },
      { status: 500 }
    );
  }

  const empresaId = profile?.empresa_id ?? null;
  if (empresaId == null) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: conversation, error: convError } = await supabase
    .schema('public')
    .from('cleria_conversations')
    .select('id, title')
    .eq('id', conversationId)
    .eq('user_uid', user.id)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (convError || !conversation?.id) {
    if (convError) {
      console.error('cleria/message: failed to validate conversation', convError);
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: insertedUserMessage, error: insertUserError } = await supabase
    .schema('public')
    .from('cleria_messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
      type: null,
      metadata: { status: 'pending' },
    })
    .select('id')
    .single();

  const insertedUserMessageId = String((insertedUserMessage as { id?: unknown } | null)?.id ?? '').trim();

  if (insertUserError || !insertedUserMessageId) {
    console.error('cleria/message: failed to insert user message', insertUserError);
    return NextResponse.json(
      { error: 'Failed to save message', detail: isDev ? insertUserError?.message : undefined },
      { status: 500 }
    );
  }

  const isUntitledConversation = String(conversation.title ?? '').trim().toLowerCase() === 'nuevo chat';
  if (isUntitledConversation) {
    const title = await generateTitleFromMessage(message);
    if (title) {
      const { error: titleError } = await supabase
        .schema('public')
        .from('cleria_conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('user_uid', user.id)
        .eq('empresa_id', empresaId);

      if (titleError) {
        console.error('cleria/message: failed to update title', titleError);
      }
    }
  }

  const markCancelled = async () => {
    const { error } = await supabase
      .schema('public')
      .from('cleria_messages')
      .update({ metadata: { status: 'cancelled' } })
      .eq('id', insertedUserMessageId)
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('cleria/message: failed to mark message cancelled', error);
    }
  };

  const markUserErrored = async () => {
    const { error } = await supabase
      .schema('public')
      .from('cleria_messages')
      .update({ metadata: { status: 'error' } })
      .eq('id', insertedUserMessageId)
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('cleria/message: failed to mark user message errored', error);
    }
  };

  let n8nRes: Response;
  try {
    n8nRes = await fetch('https://v-ascendsolutions.app.n8n.cloud/webhook/cleria_message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        user_uid: user.id,
        empresa_id: empresaId,
        message,
      }),
    });
  } catch (err) {
    const isAborted = err instanceof DOMException && err.name === 'AbortError';
    if (isAborted) {
      await markCancelled();

      return NextResponse.json({ error: 'Aborted' }, { status: 499 });
    }
    console.error('cleria/message: failed to reach n8n', err);

    await markUserErrored();

    return NextResponse.json({ status: 'ok', conversation_id: conversationId }, { status: 200 });
  }

  if (!n8nRes.ok) {
    const text = await n8nRes.text().catch(() => '');

    await markUserErrored();
    if (text) {
      console.error('cleria/message: n8n returned non-ok response', text);
    }

    return NextResponse.json({ status: 'ok', conversation_id: conversationId }, { status: 200 });
  }

  if (request.signal.aborted) {
    await markCancelled();

    return NextResponse.json({ error: 'Aborted' }, { status: 499 });
  }

  const { error: clearMetadataError } = await supabase
    .schema('public')
    .from('cleria_messages')
    .update({ metadata: null })
    .eq('id', insertedUserMessageId)
    .eq('conversation_id', conversationId);

  if (clearMetadataError) {
    console.error('cleria/message: failed to clear pending metadata', clearMetadataError);
  }

  const { error: updatedError } = await supabase
    .schema('public')
    .from('cleria_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (updatedError) {
    console.error('cleria/message: failed to update conversation updated_at', updatedError);
    return NextResponse.json(
      { error: 'Failed to update conversation', detail: isDev ? updatedError.message : undefined },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: 'ok', conversation_id: conversationId });
}
