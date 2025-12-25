import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  parseIdToken,
  parseOAuthState,
} from '@/lib/google/gmailOAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const buildRedirectUrl = (origin: string, path: string, status: 'success' | 'error', reason?: string) => {
  const url = new URL(path, origin);
  url.searchParams.set('gmail', status);

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
    const statePayload = parseOAuthState(state);
    userUid = statePayload.userUid;
    redirectPath = statePayload.redirectPath ?? '/dashboard/integraciones';
  } catch (stateError) {
    return NextResponse.json(
      { error: stateError instanceof Error ? stateError.message : 'Invalid state parameter' },
      { status: 400 }
    );
  }

  const redirectUri = new URL('/api/gmail/oauth/callback', origin).toString();

  try {
    const tokenResponse = await exchangeCodeForTokens({ code, redirectUri });

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
    const scopes = tokenResponse.scope ?? '';

    let googleProfile = parseIdToken(tokenResponse.id_token) ?? null;

    if (!googleProfile?.email || !googleProfile?.sub) {
      googleProfile = await fetchGoogleUserInfo(tokenResponse.access_token);
    }

    const { data: existingRecord } = await supabaseAdmin
      .from('gmail_accounts')
      .select('id, refresh_token')
      .eq('user_uid', userUid)
      .maybeSingle();

    const refreshToken = tokenResponse.refresh_token ?? existingRecord?.refresh_token;

    if (!refreshToken) {
      throw new Error(
        'Google did not return a refresh token. Re-run the consent screen with prompt=consent.'
      );
    }

    const payload = {
      user_uid: userUid,
      google_user_id: googleProfile?.sub ?? null,
      google_email: googleProfile?.email ?? null,
      access_token: tokenResponse.access_token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scopes,
      updated_at: new Date().toISOString(),
    };

    const upsertResult = await supabaseAdmin.from('gmail_accounts').upsert(payload, {
      onConflict: 'user_uid',
    });

    if (upsertResult.error) {
      throw upsertResult.error;
    }

    const redirectUrl = buildRedirectUrl(origin, redirectPath, 'success');
    return NextResponse.redirect(redirectUrl, { status: 302 });
  } catch (callbackError) {
    const reason =
      callbackError instanceof Error ? callbackError.message : 'Gmail authorization failed';
    const redirectUrl = buildRedirectUrl(origin, '/dashboard/integraciones', 'error', reason);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }
}
