import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

type FeedbackMessageRow = {
  feedback_id: string;
  attachments: string[] | null;
};

const CORS_SAFE_HEADERS = new Set([
  'content-type',
  'content-length',
  'cache-control',
  'etag',
  'last-modified',
]);

const buildHeaders = (source: Headers) => {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (CORS_SAFE_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set('x-robots-tag', 'noindex, nofollow');
  return headers;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ messageId: string; index: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await Promise.resolve(context.params);
  const messageId = String(params?.messageId ?? '').trim();
  const attachmentIndex = Number.parseInt(String(params?.index ?? ''), 10);

  if (!messageId) {
    return NextResponse.json({ error: 'Missing message id' }, { status: 400 });
  }

  if (!Number.isFinite(attachmentIndex) || attachmentIndex < 0) {
    return NextResponse.json({ error: 'Invalid attachment index' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: message, error: messageError } = await supabaseAdmin
    .from('feedback_messages')
    .select('feedback_id, attachments')
    .eq('id', messageId)
    .maybeSingle();

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  const typedMessage = (message ?? null) as FeedbackMessageRow | null;
  if (!typedMessage?.feedback_id) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const { data: feedback, error: feedbackError } = await supabaseAdmin
    .from('feedback_items')
    .select('id')
    .eq('id', typedMessage.feedback_id)
    .or(`user_id.eq.${user.id},visibility.eq.public`)
    .maybeSingle();

  if (feedbackError) {
    return NextResponse.json({ error: feedbackError.message }, { status: 500 });
  }

  if (!feedback?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const attachments = Array.isArray(typedMessage.attachments) ? typedMessage.attachments : [];
  const targetUrl = attachments[attachmentIndex];
  if (!targetUrl) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  const upstream = await fetch(targetUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Attachment unavailable' }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: buildHeaders(upstream.headers),
  });
}
