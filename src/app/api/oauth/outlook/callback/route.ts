import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeOutlookCodeForTokens,
  fetchOutlookProfile,
  parseOutlookOAuthState,
} from '@/lib/outlook/outlookOAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveAbsoluteUrl } from '@/lib/url';

const buildRedirectUrl = (path: string, status: 'success' | 'error', reason?: string) => {
  const url = new URL(path, resolveAbsoluteUrl('/'));
  url.searchParams.set('outlook', status);

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
    const statePayload = parseOutlookOAuthState(state);
    userUid = statePayload.userUid;
    redirectPath = statePayload.redirectPath ?? '/integraciones';
  } catch (stateError) {
    return NextResponse.json(
      { error: stateError instanceof Error ? stateError.message : 'Invalid state parameter' },
      { status: 400 }
    );
  }

  const redirectUri = resolveAbsoluteUrl('/api/oauth/outlook/callback');

  try {
    const tokenResponse = await exchangeOutlookCodeForTokens({ code, redirectUri });
    const refreshToken = tokenResponse.refresh_token;

    if (!refreshToken) {
      throw new Error('Microsoft did not return a refresh token. Repite la conexión con consentimiento.');
    }

    const expiresAt = Date.now() + tokenResponse.expires_in * 1000;
    const profile = await fetchOutlookProfile(tokenResponse.access_token);
    const accountEmail = profile.mail ?? profile.userPrincipalName ?? '';

    if (!accountEmail) {
      throw new Error('No se pudo obtener el email principal de la cuenta Outlook');
    }

    const { error: upsertError } = await supabaseAdmin.from('outlook_accounts').upsert(
      {
        user_uid: userUid,
        account_email: accountEmail,
        access_token: tokenResponse.access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      },
      {
        onConflict: 'user_uid',
      }
    );

    if (upsertError) {
      throw upsertError;
    }

    const redirectUrl = buildRedirectUrl(redirectPath, 'success');
    return NextResponse.redirect(redirectUrl, { status: 302 });
  } catch (callbackError) {
    const reason =
      callbackError instanceof Error ? callbackError.message : 'Outlook authorization failed';
    const redirectUrl = buildRedirectUrl('/integraciones', 'error', reason);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }
}
