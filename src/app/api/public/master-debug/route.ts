import { NextResponse } from 'next/server';
import type { PostgrestError } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const email = (user.email ?? '').trim().toLowerCase();

  const { data: masterRow, error: masterError } = await supabase
    .schema('public')
    .from('master_accounts')
    .select('id, master_email')
    .eq('master_email', email)
    .maybeSingle();

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: adminMasterRow, error: adminMasterError } = await supabaseAdmin
    .from('master_accounts')
    .select('id, master_email, enabled')
    .eq('master_email', email)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    email,
    userEmailRaw: user.email ?? null,
    masterRow,
    masterError: masterError ? { message: masterError.message, code: (masterError as PostgrestError).code } : null,
    adminMasterRow,
    adminMasterError: adminMasterError
      ? { message: adminMasterError.message, code: (adminMasterError as PostgrestError).code }
      : null,
    isMaster: !!masterRow?.id,
  });
}
