import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const UPLOAD_WEBHOOK_URL = 'https://v-ascendsolutions.app.n8n.cloud/webhook/upload-document';
const ACCEPTED_UPSTREAM_STATUSES = new Set([408, 429, 500, 502, 503, 504, 522, 524]);

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const incoming = await request.formData();
  const file = incoming.get('data');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const outbound = new FormData();
  outbound.append('data', file);
  outbound.append('user_uid', user.id);
  outbound.append('email', user.email ?? '');

  try {
    const webhookResponse = await fetch(UPLOAD_WEBHOOK_URL, {
      method: 'POST',
      body: outbound,
    });

    if (!webhookResponse.ok) {
      if (ACCEPTED_UPSTREAM_STATUSES.has(webhookResponse.status)) {
        return NextResponse.json({ ok: true, accepted: true, upstreamStatus: webhookResponse.status });
      }

      const responseText = await webhookResponse.text().catch(() => '');
      return NextResponse.json(
        {
          error: `Webhook respondió con ${webhookResponse.status}`,
          details: responseText || null,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo contactar con el servicio de subida' }, { status: 502 });
  }
}
