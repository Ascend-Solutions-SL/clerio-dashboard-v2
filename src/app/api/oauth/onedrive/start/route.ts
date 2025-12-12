import { NextRequest, NextResponse } from 'next/server';

import { buildOneDriveOAuthUrl, createOneDriveOAuthState } from '@/lib/onedrive/onedriveOAuth';
import { getRouteSession } from '@/lib/session';
import { resolveAbsoluteUrl } from '@/lib/url';

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getRouteSession(request, response);

  if (!session.user) {
    return NextResponse.redirect(resolveAbsoluteUrl('/auth/login?reason=onedrive-auth'), {
      status: 302,
    });
  }

  const redirectPath = request.nextUrl.searchParams.get('redirect') ?? '/integraciones';
  const state = createOneDriveOAuthState(session.user.id, redirectPath);

  const redirectUri = resolveAbsoluteUrl('/api/oauth/onedrive/callback');
  const authorizationUrl = await buildOneDriveOAuthUrl({
    state,
    redirectUri,
  });

  return NextResponse.redirect(authorizationUrl, { status: 302 });
}
