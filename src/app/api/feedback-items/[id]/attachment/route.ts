import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

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

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await Promise.resolve(context.params);
  const feedbackId = String(params?.id ?? '').trim();
  if (!feedbackId) {
    return NextResponse.json({ error: 'Missing feedback id' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: feedback, error: feedbackError } = await supabaseAdmin
    .from('feedback_items')
    .select('attachment_url')
    .eq('id', feedbackId)
    .or(`user_id.eq.${user.id},visibility.eq.public`)
    .maybeSingle();

  if (feedbackError) {
    return NextResponse.json({ error: feedbackError.message }, { status: 500 });
  }

  if (!feedback?.attachment_url) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  const upstream = await fetch(feedback.attachment_url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Attachment unavailable' }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: buildHeaders(upstream.headers),
  });
}
