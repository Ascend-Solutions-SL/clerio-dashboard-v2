import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    herramienta?: unknown;
    nivel_necesidad?: unknown;
    comentarios?: unknown;
  };

  const herramienta = typeof body.herramienta === 'string' ? body.herramienta.trim() : '';
  const nivelNecesidad = typeof body.nivel_necesidad === 'string' ? body.nivel_necesidad.trim() : '';
  const comentarios = typeof body.comentarios === 'string' ? body.comentarios.trim() : null;

  if (!herramienta) {
    return NextResponse.json({ error: 'Herramienta requerida' }, { status: 400 });
  }

  const allowed = new Set(['Urgente', 'Media', 'Baja']);
  if (!allowed.has(nivelNecesidad)) {
    return NextResponse.json({ error: 'Nivel de necesidad inválido' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin.from('solicitudes_integracion').insert({
    user_uid: user.id,
    herramienta,
    nivel_necesidad: nivelNecesidad,
    comentarios: comentarios && comentarios.length > 0 ? comentarios : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
