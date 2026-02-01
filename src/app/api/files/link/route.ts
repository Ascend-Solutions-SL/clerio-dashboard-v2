import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { refreshOneDriveAccessToken } from '@/lib/onedrive/onedriveOAuth';

type DriveType = 'googledrive' | 'onedrive';

const isDriveType = (value: unknown): value is DriveType => value === 'googledrive' || value === 'onedrive';

type Kind = 'preview' | 'download' | 'embed';

const isKind = (value: unknown): value is Kind => value === 'preview' || value === 'download' || value === 'embed';

const buildGoogleDrivePreviewUrl = (driveFileId: string) => `https://drive.google.com/file/d/${driveFileId}/preview`;
const buildGoogleDriveDownloadUrl = (driveFileId: string) => `https://drive.google.com/uc?export=download&id=${driveFileId}`;

async function fetchOneDriveItem(accessToken: string, itemId: string) {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch OneDrive item: ${text}`);
  }

  return (await response.json()) as { webUrl?: string; '@microsoft.graph.downloadUrl'?: string };
}

async function fetchOneDrivePreviewUrl(accessToken: string, itemId: string) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}/preview`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch OneDrive preview URL: ${text}`);
  }

  return (await response.json()) as { getUrl?: string };
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const driveTypeRaw = (request.nextUrl.searchParams.get('drive_type') ?? '').trim().toLowerCase();
  const driveFileId = (request.nextUrl.searchParams.get('drive_file_id') ?? '').trim();
  const kindRaw = (request.nextUrl.searchParams.get('kind') ?? '').trim().toLowerCase();

  if (!isDriveType(driveTypeRaw)) {
    return NextResponse.json({ error: 'Invalid drive_type' }, { status: 400 });
  }

  if (!driveFileId) {
    return NextResponse.json({ error: 'Missing drive_file_id' }, { status: 400 });
  }

  if (!isKind(kindRaw)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  if (driveTypeRaw === 'googledrive') {
    const url = kindRaw === 'download' ? buildGoogleDriveDownloadUrl(driveFileId) : buildGoogleDrivePreviewUrl(driveFileId);
    return NextResponse.json({ url });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: account, error: accountError } = await supabaseAdmin
    .from('onedrive_accounts')
    .select('access_token, refresh_token, expires_at')
    .eq('user_uid', user.id)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  if (!account) {
    return NextResponse.json({ error: 'OneDrive account not connected' }, { status: 409 });
  }

  let accessToken = account.access_token as string;
  const refreshToken = account.refresh_token as string;
  const expiresAt = new Date(String(account.expires_at));

  if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() - Date.now() < 60_000) {
    const refreshed = await refreshOneDriveAccessToken(refreshToken);
    accessToken = refreshed.access_token;
    const nextExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await supabaseAdmin
      .from('onedrive_accounts')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? refreshToken,
        expires_at: nextExpiresAt,
      })
      .eq('user_uid', user.id);
  }

  const item = await fetchOneDriveItem(accessToken, driveFileId);

  const previewUrl = item.webUrl ?? null;
  const downloadUrl = item['@microsoft.graph.downloadUrl'] ?? null;

  let embedUrl: string | null = null;
  if (kindRaw === 'embed') {
    const preview = await fetchOneDrivePreviewUrl(accessToken, driveFileId);
    embedUrl = preview.getUrl ?? null;
  }

  const url =
    kindRaw === 'download'
      ? downloadUrl
      : kindRaw === 'embed'
        ? embedUrl
        : previewUrl;

  if (!url) {
    return NextResponse.json({ error: 'No URL available' }, { status: 404 });
  }

  return NextResponse.json({ url });
}
