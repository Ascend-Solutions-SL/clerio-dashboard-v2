import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { assertEnv } from '@/lib/config';
import {
  AUTH_ACTIVITY_COOKIE_NAME,
  decodeAuthActivityCookie,
  encodeAuthActivityCookie,
  getAuthActivityConfig,
} from '@/lib/auth-activity';
import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware';

const isStaticAsset = (pathname: string) =>
  pathname.startsWith('/_next') ||
  pathname.startsWith('/static') ||
  pathname.startsWith('/brand') ||
  pathname.endsWith('.ico');

const isPublicPath = (pathname: string) =>
  pathname === '/login' ||
  pathname === '/onboarding' ||
  pathname.startsWith('/auth/confirm') ||
  pathname.startsWith('/auth/callback') ||
  pathname.startsWith('/api/auth/verify') ||
  pathname.startsWith('/api/gmail/oauth/start') ||
  pathname.startsWith('/api/gmail/oauth/callback') ||
  pathname.startsWith('/api/drive/oauth/start') ||
  pathname.startsWith('/api/drive/oauth/callback') ||
  pathname.startsWith('/api/oauth/outlook/start') ||
  pathname.startsWith('/api/oauth/outlook/callback') ||
  pathname.startsWith('/api/oauth/onedrive/start') ||
  pathname.startsWith('/api/oauth/onedrive/callback') ||
  pathname.startsWith('/api/public');

const isApiPath = (pathname: string) => pathname.startsWith('/api/');

const isMasterPath = (pathname: string) => pathname === '/master' || pathname.startsWith('/master/');

const isMasterApiPath = (pathname: string) => pathname.startsWith('/api/master/');

const isAuthPath = (pathname: string) => pathname === '/auth' || pathname.startsWith('/auth/');

const isOnboardingCompletePath = (pathname: string) => pathname === '/api/onboarding/complete';

const buildLoginRedirectUrl = (request: NextRequest) => {
  const redirect = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirect', redirect);
  return url;
};

const buildLoginRedirectUrlWithReason = (request: NextRequest, reason: string) => {
  const url = buildLoginRedirectUrl(request);
  url.searchParams.set('reason', reason);
  return url;
};

const redirectTo = (request: NextRequest, pathname: string) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
};

export async function middleware(request: NextRequest) {
  assertEnv();

  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.redirect(buildLoginRedirectUrl(request));
  }

  const normalizedEmail = (user.email ?? '').trim().toLowerCase();
  const { data: masterRow, error: masterError } = await supabase
    .schema('public')
    .from('master_accounts')
    .select('id')
    .eq('master_email', normalizedEmail)
    .maybeSingle();

  if (masterError) {
    console.error('[middleware] master_accounts check failed:', masterError);
  }

  const isMasterUser = !!masterRow?.id;

  if (!isMasterUser && (isMasterPath(pathname) || isMasterApiPath(pathname))) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return redirectTo(request, '/dashboard');
  }

  if (isMasterUser && !isMasterPath(pathname) && !isApiPath(pathname) && !isAuthPath(pathname)) {
    return redirectTo(request, '/master');
  }

  const { data: authUserRow, error: authUserError } = await supabase
    .schema('public')
    .from('auth_users')
    .select('is_onboarded')
    .eq('user_uid', user.id)
    .maybeSingle();

  if (authUserError) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(buildLoginRedirectUrl(request));
  }

  const isOnboarded = authUserRow?.is_onboarded === true;

  if (!isMasterUser && !isOnboarded) {
    if (pathname === '/onboarding') {
      return response;
    }

    if (isOnboardingCompletePath(pathname) && request.method === 'POST') {
      return response;
    }

    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 403 });
    }

    return redirectTo(request, '/onboarding');
  }

  const { idleTimeoutSeconds, maxSessionSeconds } = getAuthActivityConfig();
  const now = Date.now();
  const activityCookie = request.cookies.get(AUTH_ACTIVITY_COOKIE_NAME)?.value;
  const activityPayload = activityCookie ? await decodeAuthActivityCookie(activityCookie) : null;

  if (activityPayload) {
    const isIdleExpired = now - activityPayload.la > idleTimeoutSeconds * 1000;
    const isMaxExpired = now - activityPayload.ss > maxSessionSeconds * 1000;

    if (isIdleExpired || isMaxExpired) {
      const redirectUrl = buildLoginRedirectUrlWithReason(request, 'expired');
      const redirectResponse = NextResponse.redirect(redirectUrl);
      redirectResponse.cookies.delete(AUTH_ACTIVITY_COOKIE_NAME);
      redirectResponse.cookies.set(AUTH_ACTIVITY_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return redirectResponse;
    }
  }

  if (!activityPayload) {
    const encoded = await encodeAuthActivityCookie({ la: now, ss: now });
    response.cookies.set(AUTH_ACTIVITY_COOKIE_NAME, encoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxSessionSeconds,
    });
  }

  if (pathname === '/login' || pathname === '/onboarding') {
    return redirectTo(request, isMasterUser ? '/master' : '/dashboard');
  }

  if (isMasterUser && pathname.startsWith('/dashboard')) {
    return redirectTo(request, '/master');
  }

  if (!isMasterUser && isMasterPath(pathname)) {
    return redirectTo(request, '/dashboard');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
