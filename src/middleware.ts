import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ENV, assertEnv } from '@/lib/config';

const isStaticAsset = (pathname: string) =>
  pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.endsWith('.ico');

const isPublicPath = (pathname: string) =>
  pathname.startsWith('/auth/callback') ||
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

  const loginUrl = new URL(ENV.APP_BASE_URL);
  loginUrl.searchParams.set('redirect', request.nextUrl.href);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
