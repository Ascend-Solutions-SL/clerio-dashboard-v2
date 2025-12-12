import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getRouteSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getRouteSession(request, response);

  if (!session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('onedrive_accounts')
    .select('id, account_email, drive_name, updated_at')
    .eq('user_uid', session.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    account: {
      id: data.id,
      email: data.account_email,
      driveName: data.drive_name,
      updatedAt: data.updated_at,
    },
  });
}
