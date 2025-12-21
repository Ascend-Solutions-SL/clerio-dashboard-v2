import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { assertEnv } from '@/lib/config';
import { resolveLoginUrl } from '@/lib/session';

const isStaticAsset = (pathname: string) =>
  pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.endsWith('.ico');

const isPublicPath = (pathname: string) =>
  pathname.startsWith('/auth/callback') ||
  pathname.startsWith('/auth/login') ||
  pathname.startsWith('/api/auth/verify') ||
  pathname.startsWith('/api/auth/logout') ||
  pathname.startsWith('/api/auth/session');

export async function middleware(request: NextRequest) {
  assertEnv();

  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('clerio_session');

  if (sessionCookie) {
    return NextResponse.next();
  }

  const relativeRedirect = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  let loginUrl = new URL(resolveLoginUrl());
  if (loginUrl.origin === request.nextUrl.origin) {
    loginUrl = new URL('https://clerio-login.vercel.app');
  }
  loginUrl.searchParams.set('redirect', relativeRedirect);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
