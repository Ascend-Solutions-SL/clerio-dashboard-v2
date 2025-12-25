import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { assertEnv } from '@/lib/config';
import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware';

const isStaticAsset = (pathname: string) =>
  pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.endsWith('.ico');

const isPublicPath = (pathname: string) =>
  pathname === '/login' ||
  pathname === '/onboarding' ||
  pathname.startsWith('/auth/callback') ||
  pathname.startsWith('/api/auth/verify') ||
  pathname.startsWith('/api/gmail/oauth/start') ||
  pathname.startsWith('/api/drive/oauth/start') ||
  pathname.startsWith('/api/oauth/outlook/start') ||
  pathname.startsWith('/api/oauth/onedrive/start') ||
  pathname.startsWith('/api/public');

const isApiPath = (pathname: string) => pathname.startsWith('/api/');

const isOnboardingCompletePath = (pathname: string) => pathname === '/api/onboarding/complete';

const buildLoginRedirectUrl = (request: NextRequest) => {
  const redirect = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirect', redirect);
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

  if (!isOnboarded) {
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

  if (pathname === '/login' || pathname === '/onboarding') {
    return redirectTo(request, '/dashboard');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
