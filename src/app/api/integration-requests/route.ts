import { NextRequest, NextResponse } from 'next/server';

import { getRouteSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const REQUIRED_FIELDS = ['toolName', 'urgencyLevel'] as const;
const ALLOWED_URGENCY = ['Estaría bien tenerlo', 'Lo uso muy a menudo', 'Imprescindible/Urgente'];

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getRouteSession(request, response);

  if (!session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    toolName?: string;
    urgencyLevel?: string;
    comments?: string;
  };

  for (const field of REQUIRED_FIELDS) {
    const value = payload[field];
    if (!value || typeof value !== 'string' || !value.trim()) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  if (!ALLOWED_URGENCY.includes(payload.urgencyLevel!.trim())) {
    return NextResponse.json({ error: 'Invalid urgency level' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('solicitudes_integracion').insert({
    user_uid: session.user.id,
    herramienta: payload.toolName!.trim(),
    nivel_necesidad: payload.urgencyLevel!.trim(),
    comentarios: payload.comments?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
