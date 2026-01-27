import { NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET() {
  const guard = await requireMasterUser();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: empresas, error: empresasError } = await supabaseAdmin
    .from('empresas')
    .select('id, empresa, cif, direccion, telefono, email')
    .order('id', { ascending: false })
    .limit(200);

  if (empresasError) {
    return NextResponse.json({ error: empresasError.message }, { status: 500 });
  }

  const { data: usuarios, error: usuariosError } = await supabaseAdmin
    .from('auth_users')
    .select(
      'user_uid, created_at, user_email, first_name, last_name, user_businessname, user_business_cif, user_role, empresa_id'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (usuariosError) {
    return NextResponse.json({ error: usuariosError.message }, { status: 500 });
  }

  return NextResponse.json({ empresas: empresas ?? [], usuarios: usuarios ?? [] });
}
