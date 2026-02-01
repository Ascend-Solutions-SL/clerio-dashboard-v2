import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { refreshDriveAccessToken } from '@/lib/google/driveOAuth';
import { refreshOneDriveAccessToken } from '@/lib/onedrive/onedriveOAuth';

type DriveType = 'googledrive' | 'onedrive';

type Kind = 'preview' | 'download';

const isDriveType = (value: unknown): value is DriveType => value === 'googledrive' || value === 'onedrive';
const isKind = (value: unknown): value is Kind => value === 'preview' || value === 'download';

const buildGoogleDrivePreviewUrl = (driveFileId: string) => `https://drive.google.com/file/d/${driveFileId}/preview`;
const buildGoogleDriveDownloadUrl = (driveFileId: string) => `https://drive.google.com/uc?export=download&id=${driveFileId}`;

async function fetchGoogleDriveFileMeta(accessToken: string, fileId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,mimeType`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Google Drive metadata: ${text}`);
  }

  return (await response.json()) as { name?: string; mimeType?: string };
}

async function fetchGoogleDriveFileMedia(accessToken: string, fileId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to download Google Drive file: ${text}`);
  }

  return response;
}

async function fetchOneDrivePreviewUrl(accessToken: string, itemId: string) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}/preview`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
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
    if (kindRaw === 'preview') {
      const url = buildGoogleDrivePreviewUrl(driveFileId);
      return NextResponse.redirect(url, { status: 302 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: account, error: accountError } = await supabaseAdmin
      .from('drive_accounts')
      .select('access_token, refresh_token, expires_at')
      .eq('user_uid', user.id)
      .maybeSingle();

    if (accountError) {
      return NextResponse.json({ error: accountError.message }, { status: 500 });
    }

    if (!account) {
      // Fallback a redirect clásico si no hay cuenta conectada.
      const url = buildGoogleDriveDownloadUrl(driveFileId);
      return NextResponse.redirect(url, { status: 302 });
    }

    let accessToken = account.access_token as string;
    const refreshToken = account.refresh_token as string;
    const expiresAt = new Date(String(account.expires_at));

    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() - Date.now() < 60_000) {
      const refreshed = await refreshDriveAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      const nextExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await supabaseAdmin
        .from('drive_accounts')
        .update({
          access_token: refreshed.access_token,
          expires_at: nextExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_uid', user.id);
    }

    const meta = await fetchGoogleDriveFileMeta(accessToken, driveFileId);
    const mediaResponse = await fetchGoogleDriveFileMedia(accessToken, driveFileId);

    const contentType = mediaResponse.headers.get('content-type') ?? meta.mimeType ?? 'application/octet-stream';
    const fileName = meta.name ?? 'archivo';

    return new NextResponse(mediaResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName.replace(/\"/g, '')}"`,
        'Cache-Control': 'no-store',
      },
    });
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
  let previewUrl: string | null = null;
  try {
    const preview = await fetchOneDrivePreviewUrl(accessToken, driveFileId);
    previewUrl = preview.getUrl ?? null;
  } catch {
    previewUrl = item.webUrl ?? null;
  }
  const downloadUrl = item['@microsoft.graph.downloadUrl'] ?? null;

  const resolved = kindRaw === 'download' ? downloadUrl : previewUrl;

  if (!resolved) {
    return NextResponse.json({ error: 'No URL available' }, { status: 404 });
  }

  return NextResponse.redirect(resolved, { status: 302 });
}
