import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeDriveCodeForTokens,
  fetchDriveUserInfo,
  parseDriveOAuthState,
} from '@/lib/google/driveOAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveAbsoluteUrl } from '@/lib/url';

const buildRedirectUrl = (path: string, status: 'success' | 'error', reason?: string) => {
  const url = new URL(path, resolveAbsoluteUrl('/'));
  url.searchParams.set('drive', status);

  if (reason) {
    url.searchParams.set('reason', reason);
  }

  return url.toString();
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    const redirectUrl = buildRedirectUrl('/integraciones', 'error', error);
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
    redirectPath = statePayload.redirectPath ?? '/integraciones';
  } catch (stateError) {
    return NextResponse.json(
      { error: stateError instanceof Error ? stateError.message : 'Invalid state parameter' },
      { status: 400 }
    );
  }

  const redirectUri = resolveAbsoluteUrl('/api/drive/oauth/callback');

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
      updated_at: new Date().toISOString(),
    };

    const upsertResult = await supabaseAdmin.from('drive_accounts').upsert(payload, {
      onConflict: 'user_uid',
    });

    if (upsertResult.error) {
      throw upsertResult.error;
    }

    const redirectUrl = buildRedirectUrl(redirectPath, 'success');
    return NextResponse.redirect(redirectUrl, { status: 302 });
  } catch (callbackError) {
    const reason =
      callbackError instanceof Error ? callbackError.message : 'Drive authorization failed';
    const redirectUrl = buildRedirectUrl('/integraciones', 'error', reason);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }
}
