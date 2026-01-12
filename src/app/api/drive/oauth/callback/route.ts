import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeDriveCodeForTokens,
  fetchDriveUserInfo,
  parseDriveOAuthState,
} from '@/lib/google/driveOAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const N8N_DRIVE_INTEGRATION_WEBHOOK_URL =
  'https://v-ascendsolutions.app.n8n.cloud/webhook/drive-integration';

const buildRedirectUrl = (origin: string, path: string, status: 'success' | 'error', reason?: string) => {
  const url = new URL(path, origin);
  url.searchParams.set('drive', status);

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
    let redirectPath = '/dashboard/integraciones';

    if (state) {
      try {
        const statePayload = parseDriveOAuthState(state);
        redirectPath = statePayload.redirectPath ?? redirectPath;

        if (redirectPath === '/onboarding') {
          redirectPath = '/onboarding?step=3&integrationStage=storage';
        }
      } catch {
        // ignore state parsing errors and fallback to dashboard
      }
    }

    const redirectUrl = buildRedirectUrl(origin, redirectPath, 'error', error);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  let userUid: string;
  let redirectPath: string;

  try {
    const statePayload = parseDriveOAuthState(state);
    userUid = statePayload.userUid;
    redirectPath = statePayload.redirectPath ?? '/dashboard/integraciones';

    if (redirectPath === '/onboarding') {
      redirectPath = '/onboarding?step=3&integrationStage=storage';
    }
  } catch (stateError) {
    return NextResponse.json(
      { error: stateError instanceof Error ? stateError.message : 'Invalid state parameter' },
      { status: 400 }
    );
  }

  const redirectUri = new URL('/api/drive/oauth/callback', origin).toString();

  try {
    const tokenResponse = await exchangeDriveCodeForTokens({ code, redirectUri });

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
    const scopes = tokenResponse.scope ?? '';

    const driveProfile = await fetchDriveUserInfo(tokenResponse.access_token);

    const { data: existingRecord } = await supabaseAdmin
      .from('drive_accounts')
      .select('id, refresh_token')
      .eq('user_uid', userUid)
      .maybeSingle();

    const refreshToken = tokenResponse.refresh_token ?? existingRecord?.refresh_token;

    if (!refreshToken) {
      throw new Error(
        'Google Drive did not return a refresh token. Repite la conexión con prompt=consent.'
      );
    }

    const payload = {
      user_uid: userUid,
      google_user_id: driveProfile.sub,
      google_email: driveProfile.email,
      access_token: tokenResponse.access_token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scopes,
      drive_deposit_folder_id: '',
      drive_org_folder_id: '',
      updated_at: new Date().toISOString(),
    };

    const upsertResult = await supabaseAdmin.from('drive_accounts').upsert(payload, {
      onConflict: 'user_uid',
    });

    if (upsertResult.error) {
      throw upsertResult.error;
    }

    try {
      await fetch(N8N_DRIVE_INTEGRATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_uid: userUid,
          google_email: driveProfile.email,
          google_user_id: driveProfile.sub,
        }),
      });
    } catch (webhookError) {
      console.error('Failed to trigger n8n drive integration webhook', webhookError);
    }

    const redirectUrl = buildRedirectUrl(origin, redirectPath, 'success');
    return NextResponse.redirect(redirectUrl, { status: 302 });
  } catch (callbackError) {
    const reason =
      callbackError instanceof Error ? callbackError.message : 'Drive authorization failed';
    const redirectUrl = buildRedirectUrl(origin, redirectPath, 'error', reason);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }
}
