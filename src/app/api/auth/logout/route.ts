import { NextRequest, NextResponse } from 'next/server';

import { getRouteSession, resolveLoginUrl } from '@/lib/session';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const session = await getRouteSession(request, response);

  await session.destroy();

  return response;
}

export async function GET(request: NextRequest) {
  const loginUrl = resolveLoginUrl();
  const response = NextResponse.redirect(loginUrl, { status: 303 });
  const session = await getRouteSession(request, response);

  await session.destroy();

  return response;
}
