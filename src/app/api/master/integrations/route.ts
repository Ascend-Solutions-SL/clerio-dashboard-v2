import { NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

type IntegrationRow = {
  user_uid: string;
  first_name: string;
  last_name: string;
  user_businessname: string;
  email: string;
};

const mapGoogle = (rows: any[] | null, field: 'google_email'): IntegrationRow[] =>
  (rows ?? []).map((r) => ({
    user_uid: r.user_uid,
    first_name: r.auth_users?.first_name ?? '',
    last_name: r.auth_users?.last_name ?? '',
    user_businessname: r.auth_users?.user_businessname ?? '',
    email: r[field] ?? '',
  }));

const mapAccount = (rows: any[] | null, field: 'account_email'): IntegrationRow[] =>
  (rows ?? []).map((r) => ({
    user_uid: r.user_uid,
    first_name: r.auth_users?.first_name ?? '',
    last_name: r.auth_users?.last_name ?? '',
    user_businessname: r.auth_users?.user_businessname ?? '',
    email: r[field] ?? '',
  }));

const mapAccountWithProfiles = (rows: any[] | null, profiles: Record<string, any>, field: 'account_email'): IntegrationRow[] =>
  (rows ?? []).map((r) => ({
    user_uid: r.user_uid,
    first_name: profiles[r.user_uid]?.first_name ?? '',
    last_name: profiles[r.user_uid]?.last_name ?? '',
    user_businessname: profiles[r.user_uid]?.user_businessname ?? '',
    email: r[field] ?? '',
  }));

const buildProfileMap = (profiles: any[] | null) =>
  Object.fromEntries((profiles ?? []).map((p) => [p.user_uid, p]));

export async function GET() {
  const guard = await requireMasterUser();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: driveRows, error: driveError } = await supabaseAdmin
    .from('drive_accounts')
    .select('user_uid, google_email, auth_users(first_name,last_name,user_businessname)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (driveError) {
    return NextResponse.json({ error: driveError.message }, { status: 500 });
  }

  const { data: gmailRows, error: gmailError } = await supabaseAdmin
    .from('gmail_accounts')
    .select('user_uid, google_email, auth_users(first_name,last_name,user_businessname)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (gmailError) {
    return NextResponse.json({ error: gmailError.message }, { status: 500 });
  }

  const { data: onedriveRows, error: onedriveError } = await supabaseAdmin
    .from('onedrive_accounts')
    .select('user_uid, account_email')
    .order('created_at', { ascending: false })
    .limit(500);

  if (onedriveError) {
    return NextResponse.json({ error: onedriveError.message }, { status: 500 });
  }

  const { data: outlookRows, error: outlookError } = await supabaseAdmin
    .from('outlook_accounts')
    .select('user_uid, account_email')
    .order('created_at', { ascending: false })
    .limit(500);

  if (outlookError) {
    return NextResponse.json({ error: outlookError.message }, { status: 500 });
  }

  const accountUserUids = Array.from(
    new Set([...(onedriveRows ?? []), ...(outlookRows ?? [])].map((row: any) => row.user_uid).filter(Boolean))
  );

  let profileMap: Record<string, any> = {};

  if (accountUserUids.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('auth_users')
      .select('user_uid, first_name, last_name, user_businessname')
      .in('user_uid', accountUserUids);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    profileMap = buildProfileMap(profiles as any);
  }

  return NextResponse.json({
    drive: mapGoogle(driveRows as any, 'google_email'),
    gmail: mapGoogle(gmailRows as any, 'google_email'),
    onedrive: mapAccountWithProfiles(onedriveRows as any, profileMap, 'account_email'),
    outlook: mapAccountWithProfiles(outlookRows as any, profileMap, 'account_email'),
  });
}
