import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

import { ENV, assertEnv } from '@/lib/config';

import { getRouteSession } from '@/lib/session';

interface DashboardTokenPayload extends jwt.JwtPayload {
  sub: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  user_initials?: string;
  user_businessname?: string;
  phone?: string;
}

const createSupabaseAdminClient = () => {
  const url = ENV.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son necesarias');
  }

  return createClient(url, serviceKey);
};

export async function POST(request: NextRequest) {
  assertEnv();
  const secret = process.env.DASHBOARD_SIGNING_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: 'Falta la variable DASHBOARD_SIGNING_SECRET' },
      { status: 500 }
    );
  }

  const { token } = await request.json().catch(() => ({ token: null }));

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  let payload: DashboardTokenPayload;

  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded === 'string' || !decoded.sub) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }

    payload = decoded as DashboardTokenPayload;
  } catch {
    return NextResponse.json({ error: 'Token caducado o inválido' }, { status: 401 });
  }

  const successResponse = NextResponse.json({ ok: true });
  const session = await getRouteSession(request, successResponse);

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: profileData } = await supabaseAdmin
    .from('auth_users')
    .select('first_name, last_name, user_initials, user_businessname, user_phone, user_email, user_role, empresa_id')
    .eq('user_uid', payload.sub)
    .single();

  console.log('[auth/verify] payload', payload);
  console.log('[auth/verify] profileData', profileData);

  session.user = {
    id: payload.sub,
    email: profileData?.user_email ?? payload.email ?? '',
    firstName: profileData?.first_name ?? payload.first_name ?? '',
    lastName: profileData?.last_name ?? payload.last_name ?? '',
    initials: profileData?.user_initials ?? payload.user_initials ?? '',
    businessName: profileData?.user_businessname ?? payload.user_businessname ?? '',
    empresaId: profileData?.empresa_id ?? null,
    role: profileData?.user_role ?? '',
    phone: profileData?.user_phone ?? payload.phone ?? '',
  };
  session.lastActivity = Date.now();

  await session.save();

  return successResponse;
}
