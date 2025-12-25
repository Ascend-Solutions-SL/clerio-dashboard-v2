import { NextRequest, NextResponse } from 'next/server';

import { buildDriveOAuthUrl, createDriveOAuthState } from '@/lib/google/driveOAuth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('redirect', '/integraciones');
    loginUrl.searchParams.set('reason', 'drive-auth');
    return NextResponse.redirect(loginUrl.toString(), { status: 302 });
  }

  const redirectPath = request.nextUrl.searchParams.get('redirect') ?? '/integraciones';
  const state = createDriveOAuthState(user.id, redirectPath);

  const redirectUri = new URL('/api/drive/oauth/callback', origin).toString();
  const authorizationUrl = buildDriveOAuthUrl({
    state,
    redirectUri,
  });

  return NextResponse.redirect(authorizationUrl, { status: 302 });
}
