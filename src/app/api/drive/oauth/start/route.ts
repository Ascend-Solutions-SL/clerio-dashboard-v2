import { NextRequest, NextResponse } from 'next/server';

import { buildDriveOAuthUrl, createDriveOAuthState } from '@/lib/google/driveOAuth';
import { getRouteSession } from '@/lib/session';
import { resolveAbsoluteUrl } from '@/lib/url';

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getRouteSession(request, response);

  if (!session.user) {
    return NextResponse.redirect(resolveAbsoluteUrl('/auth/login?reason=drive-auth'), {
      status: 302,
    });
  }

  const redirectPath = request.nextUrl.searchParams.get('redirect') ?? '/integraciones';
  const state = createDriveOAuthState(session.user.id, redirectPath);

  const redirectUri = resolveAbsoluteUrl('/api/drive/oauth/callback');
  const authorizationUrl = buildDriveOAuthUrl({
    state,
    redirectUri,
  });

  return NextResponse.redirect(authorizationUrl, { status: 302 });
}
