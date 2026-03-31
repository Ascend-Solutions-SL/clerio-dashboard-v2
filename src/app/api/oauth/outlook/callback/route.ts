import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeOutlookCodeForTokens,
  fetchOutlookProfile,
  parseOutlookOAuthState,
} from '@/lib/outlook/outlookOAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const buildRedirectUrl = (origin: string, path: string, status: 'success' | 'error', reason?: string) => {
  const url = new URL(path, origin);
  url.searchParams.set('outlook', status);

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
        const statePayload = parseOutlookOAuthState(state);
        redirectPath = statePayload.redirectPath ?? redirectPath;

        if (redirectPath === '/onboarding') {
          redirectPath = '/onboarding?step=3&integrationStage=email';
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
    const statePayload = parseOutlookOAuthState(state);
    userUid = statePayload.userUid;
    redirectPath = statePayload.redirectPath ?? '/dashboard/integraciones';

    if (redirectPath === '/onboarding') {
      redirectPath = '/onboarding?step=3&integrationStage=email';
    }
  } catch (stateError) {
    return NextResponse.json(
      { error: stateError instanceof Error ? stateError.message : 'Invalid state parameter' },
      { status: 400 }
    );
  }

  const redirectUri = new URL('/api/oauth/outlook/callback', origin).toString();

  try {
    const tokenResponse = await exchangeOutlookCodeForTokens({ code, redirectUri });
    const refreshToken = tokenResponse.refresh_token;

    if (!refreshToken) {
      throw new Error('Microsoft did not return a refresh token. Repite la conexión con consentimiento.');
    }

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
    const profile = await fetchOutlookProfile(tokenResponse.access_token);
    const accountEmail = profile.mail ?? profile.userPrincipalName ?? '';

    if (!accountEmail) {
      throw new Error('No se pudo obtener el email principal de la cuenta Outlook');
    }

    const insertResult = await supabaseAdmin.from('outlook_accounts').insert({
      user_uid: userUid,
      onedrive_email: accountEmail,
      access_token: tokenResponse.access_token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });

    if (insertResult.error) {
      if (insertResult.error.code !== '23505') {
        throw insertResult.error;
      }

      const updateResult = await supabaseAdmin
        .from('outlook_accounts')
        .update({
          onedrive_email: accountEmail,
          access_token: tokenResponse.access_token,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_uid', userUid);

      if (updateResult.error) {
        throw updateResult.error;
      }
    }

    const { error: emailTypeUpdateError } = await supabaseAdmin
      .from('auth_users')
      .update({ email_type: 'outlook' })
      .eq('user_uid', userUid);

    if (emailTypeUpdateError) {
      throw emailTypeUpdateError;
    }

    const redirectUrl = buildRedirectUrl(origin, redirectPath, 'success');
    return NextResponse.redirect(redirectUrl, { status: 302 });
  } catch (callbackError) {
    const reason =
      callbackError instanceof Error ? callbackError.message : 'Outlook authorization failed';
    const redirectUrl = buildRedirectUrl(origin, redirectPath, 'error', reason);
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }
}
