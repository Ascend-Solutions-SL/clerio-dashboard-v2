import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

type ProfilePayload = {
  employee: {
    firstName: string;
    lastName: string;
    email: string;
  };
  company: {
    businessName: string;
    cif: string;
    phone: string;
    address: string;
  };
  role: 'admin' | 'empleado' | string;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: authUser, error: authUserError } = await supabaseAdmin
    .from('auth_users')
    .select('first_name, last_name, user_email, user_businessname, user_business_cif, user_role, empresa_id')
    .eq('user_uid', user.id)
    .maybeSingle();

  if (authUserError || !authUser) {
    return NextResponse.json({ error: authUserError?.message ?? 'No auth_user row' }, { status: 500 });
  }

  const empresaId = authUser.empresa_id as number | null;

  let empresaPhone = '';
  let empresaAddress = '';

  if (empresaId) {
    const { data: empresaRow, error: empresaError } = await supabaseAdmin
      .from('empresas')
      .select('telefono, direccion')
      .eq('id', empresaId)
      .maybeSingle();

    if (empresaError) {
      return NextResponse.json({ error: empresaError.message }, { status: 500 });
    }

    empresaPhone = (empresaRow?.telefono ?? '') as string;
    empresaAddress = (empresaRow?.direccion ?? '') as string;
  }

  const payload: ProfilePayload = {
    employee: {
      firstName: (authUser.first_name ?? '') as string,
      lastName: (authUser.last_name ?? '') as string,
      email: (authUser.user_email ?? '') as string,
    },
    company: {
      businessName: (authUser.user_businessname ?? '') as string,
      cif: ((authUser.user_business_cif ?? '') as string) || '',
      phone: empresaPhone,
      address: empresaAddress,
    },
    role: (authUser.user_role ?? '') as string,
  };

  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { telefono?: unknown; direccion?: unknown };

  const telefono = typeof body.telefono === 'string' ? body.telefono : '';
  const direccion = typeof body.direccion === 'string' ? body.direccion : '';

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: authUser, error: authUserError } = await supabaseAdmin
    .from('auth_users')
    .select('empresa_id')
    .eq('user_uid', user.id)
    .maybeSingle();

  if (authUserError || !authUser) {
    return NextResponse.json({ error: authUserError?.message ?? 'No auth_user row' }, { status: 500 });
  }

  const empresaId = authUser.empresa_id as number | null;

  if (!empresaId) {
    return NextResponse.json({ error: 'missing_empresa_id' }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('empresas')
    .update({
      telefono: telefono.trim() ? telefono.trim() : null,
      direccion: direccion.trim() ? direccion.trim() : null,
    })
    .eq('id', empresaId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
