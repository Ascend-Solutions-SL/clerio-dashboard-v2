import { NextRequest, NextResponse } from 'next/server';

import { buildGoogleOAuthUrl, createOAuthState } from '@/lib/google/gmailOAuth';
import { getRouteSession } from '@/lib/session';
import { resolveAbsoluteUrl, resolveAppBaseUrl } from '@/lib/url';

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getRouteSession(request, response);

  if (!session.user) {
    return NextResponse.redirect(resolveAbsoluteUrl('/auth/login?reason=gmail-auth'), {
      status: 302,
    });
  }

  const redirectPath = request.nextUrl.searchParams.get('redirect') ?? '/integraciones';
  const state = createOAuthState(session.user.id, redirectPath);

  const redirectUri = resolveAbsoluteUrl('/api/gmail/oauth/callback');
  const authorizationUrl = buildGoogleOAuthUrl({
    state,
    redirectUri,
  });

  return NextResponse.redirect(authorizationUrl, { status: 302 });
}
