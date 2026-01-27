import { NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

type SolicitudJoinRow = {
  id: string;
  created_at: string;
  herramienta: string;
  nivel_necesidad: string;
  comentarios: string | null;
  user_uid: string;
  auth_users: {
    first_name: string | null;
    last_name: string | null;
    user_businessname: string | null;
  } | null;
};

export async function GET() {
  const guard = await requireMasterUser();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from('solicitudes_integracion')
    .select(
      'id, created_at, herramienta, nivel_necesidad, comentarios, user_uid, auth_users(first_name,last_name,user_businessname)'
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const solicitudes = ((data as unknown as SolicitudJoinRow[] | null) ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    herramienta: row.herramienta,
    nivel_necesidad: row.nivel_necesidad,
    comentarios: row.comentarios,
    user_uid: row.user_uid,
    first_name: row.auth_users?.first_name ?? '',
    last_name: row.auth_users?.last_name ?? '',
    user_businessname: row.auth_users?.user_businessname ?? '',
  }));

  return NextResponse.json({ solicitudes });
}
