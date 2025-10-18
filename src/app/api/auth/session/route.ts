import { NextRequest, NextResponse } from 'next/server';

import { getRouteSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const intermediateResponse = NextResponse.next();
  const session = await getRouteSession(request, intermediateResponse);

  if (!session.user) {
    return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
  }

  return NextResponse.json({ user: session.user });
}
