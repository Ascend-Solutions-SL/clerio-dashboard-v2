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

type AuthUserSummary = {
  first_name: string | null;
  last_name: string | null;
  user_businessname: string | null;
};

type DriveAccountRow = {
  user_uid: string;
  google_email: string;
  auth_users: AuthUserSummary | null;
};

type GmailAccountRow = {
  user_uid: string;
  google_email: string;
  auth_users: AuthUserSummary | null;
};

type OneDriveAccountRow = {
  user_uid: string;
  onedrive_email: string;
};

type OutlookAccountRow = {
  user_uid: string;
  onedrive_email: string;
};

type ProfileRow = {
  user_uid: string;
  first_name: string | null;
  last_name: string | null;
  user_businessname: string | null;
};

const mapDrive = (rows: DriveAccountRow[] | null): IntegrationRow[] =>
  (rows ?? []).map((r) => ({
    user_uid: r.user_uid,
    first_name: r.auth_users?.first_name ?? '',
    last_name: r.auth_users?.last_name ?? '',
    user_businessname: r.auth_users?.user_businessname ?? '',
    email: r.google_email ?? '',
  }));

const mapGmail = (rows: GmailAccountRow[] | null): IntegrationRow[] =>
  (rows ?? []).map((r) => ({
    user_uid: r.user_uid,
    first_name: r.auth_users?.first_name ?? '',
    last_name: r.auth_users?.last_name ?? '',
    user_businessname: r.auth_users?.user_businessname ?? '',
    email: r.google_email ?? '',
  }));

const buildProfileMap = (profiles: ProfileRow[] | null): Record<string, ProfileRow> =>
  Object.fromEntries((profiles ?? []).map((p) => [p.user_uid, p]));

const mapAccountWithProfiles = <T extends { user_uid: string }, K extends keyof T>(
  rows: T[] | null,
  profiles: Record<string, ProfileRow>,
  field: K
): IntegrationRow[] =>
  (rows ?? []).map((r) => ({
    user_uid: r.user_uid,
    first_name: profiles[r.user_uid]?.first_name ?? '',
    last_name: profiles[r.user_uid]?.last_name ?? '',
    user_businessname: profiles[r.user_uid]?.user_businessname ?? '',
    email: String(r[field] ?? ''),
  }));

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
    .select('user_uid, onedrive_email')
    .order('created_at', { ascending: false })
    .limit(500);

  if (onedriveError) {
    return NextResponse.json({ error: onedriveError.message }, { status: 500 });
  }

  const { data: outlookRows, error: outlookError } = await supabaseAdmin
    .from('outlook_accounts')
    .select('user_uid, onedrive_email')
    .order('created_at', { ascending: false })
    .limit(500);

  if (outlookError) {
    return NextResponse.json({ error: outlookError.message }, { status: 500 });
  }

  const typedOneDriveRows = (onedriveRows as unknown as OneDriveAccountRow[] | null) ?? null;
  const typedOutlookRows = (outlookRows as unknown as OutlookAccountRow[] | null) ?? null;

  const accountUserUids = Array.from(
    new Set([...(typedOneDriveRows ?? []), ...(typedOutlookRows ?? [])].map((row) => row.user_uid).filter(Boolean))
  );

  let profileMap: Record<string, ProfileRow> = {};

  if (accountUserUids.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('auth_users')
      .select('user_uid, first_name, last_name, user_businessname')
      .in('user_uid', accountUserUids);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    profileMap = buildProfileMap(profiles as unknown as ProfileRow[] | null);
  }

  return NextResponse.json({
    drive: mapDrive(driveRows as unknown as DriveAccountRow[] | null),
    gmail: mapGmail(gmailRows as unknown as GmailAccountRow[] | null),
    onedrive: mapAccountWithProfiles(typedOneDriveRows, profileMap, 'onedrive_email'),
    outlook: mapAccountWithProfiles(typedOutlookRows, profileMap, 'onedrive_email'),
  });
}
