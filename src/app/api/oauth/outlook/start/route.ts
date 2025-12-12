import { NextRequest, NextResponse } from 'next/server';

import { buildOutlookOAuthUrl, createOutlookOAuthState } from '@/lib/outlook/outlookOAuth';
import { getRouteSession } from '@/lib/session';
import { resolveAbsoluteUrl } from '@/lib/url';

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getRouteSession(request, response);

  if (!session.user) {
    return NextResponse.redirect(resolveAbsoluteUrl('/auth/login?reason=outlook-auth'), {
      status: 302,
    });
  }

  const redirectPath = request.nextUrl.searchParams.get('redirect') ?? '/integraciones';
  const state = createOutlookOAuthState(session.user.id, redirectPath);

  const redirectUri = resolveAbsoluteUrl('/api/oauth/outlook/callback');
  const authorizationUrl = await buildOutlookOAuthUrl({
    state,
    redirectUri,
  });

  return NextResponse.redirect(authorizationUrl, { status: 302 });
}
