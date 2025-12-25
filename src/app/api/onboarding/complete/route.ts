import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error: updateError } = await supabase
    .schema('public')
    .from('auth_users')
    .update({ is_onboarded: true })
    .eq('user_uid', user.id);

  if (updateError) {
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      {
        error: 'No se pudo actualizar el estado de onboarding',
        detail: isDev ? updateError.message : undefined,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
