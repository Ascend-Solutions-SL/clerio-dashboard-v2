import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeOneDriveCodeForTokens,
  fetchOneDriveDriveInfo,
  fetchOneDriveProfile,
  parseOneDriveOAuthState,
} from '@/lib/onedrive/onedriveOAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const N8N_ONEDRIVE_INTEGRATION_WEBHOOK_URL =
  'https://v-ascendsolutions.app.n8n.cloud/webhook/outlook-integration';

const buildRedirectUrl = (origin: string, path: string, status: 'success' | 'error', reason?: string) => {
  const url = new URL(path, origin);
  url.searchParams.set('onedrive', status);

  if (reason) {
    url.searchParams.set('reason', reason);
  }

  return url.toString();
};

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    const redirectUrl = buildRedirectUrl(origin, '/dashboard/integraciones', 'error', error);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  let userUid: string;
  let redirectPath: string;

  try {
    const statePayload = parseOneDriveOAuthState(state);
    userUid = statePayload.userUid;
    redirectPath = statePayload.redirectPath ?? '/dashboard/integraciones';
  } catch (stateError) {
    return NextResponse.json(
      { error: stateError instanceof Error ? stateError.message : 'Invalid state parameter' },
      { status: 400 }
    );
  }

  const redirectUri = new URL('/api/oauth/onedrive/callback', origin).toString();

  try {
    const tokenResponse = await exchangeOneDriveCodeForTokens({ code, redirectUri });

    const refreshToken = tokenResponse.refresh_token;

    if (!refreshToken) {
      throw new Error('Microsoft did not return a refresh token. Repite la conexión con consentimiento.');
    }

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
    const profile = await fetchOneDriveProfile(tokenResponse.access_token);
    const driveInfo = await fetchOneDriveDriveInfo(tokenResponse.access_token);

    const onedriveEmail = profile.mail ?? profile.userPrincipalName ?? '';

    if (!onedriveEmail) {
      throw new Error('No se pudo obtener el email principal de la cuenta OneDrive');
    }

    const { error: upsertError } = await supabaseAdmin.from('onedrive_accounts').upsert(
      {
        user_uid: userUid,
        onedrive_email: onedriveEmail,
        onedrive_id: driveInfo.id ?? null,
        drive_created_at: driveInfo.createdDateTime ?? null,
        access_token: tokenResponse.access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        onedrive_org_folder_id: null,
        onedrive_deposit_folder_id: null,
      },
      {
        onConflict: 'user_uid',
      }
    );

    if (upsertError) {
      throw upsertError;
    }

    try {
      await fetch(N8N_ONEDRIVE_INTEGRATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_uid: userUid,
          onedrive_email: onedriveEmail,
          onedrive_id: driveInfo.id ?? null,
        }),
      });
    } catch (webhookError) {
      console.error('Failed to trigger n8n onedrive integration webhook', webhookError);
    }

    const redirectUrl = buildRedirectUrl(origin, redirectPath, 'success');
    return NextResponse.redirect(redirectUrl, { status: 302 });
  } catch (callbackError) {
    const reason =
      callbackError instanceof Error ? callbackError.message : 'OneDrive authorization failed';
    const redirectUrl = buildRedirectUrl(origin, '/dashboard/integraciones', 'error', reason);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }
}
