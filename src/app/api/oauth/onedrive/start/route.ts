import { NextRequest, NextResponse } from 'next/server';

import { buildOneDriveOAuthUrl, createOneDriveOAuthState } from '@/lib/onedrive/onedriveOAuth';
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
    loginUrl.searchParams.set('redirect', '/dashboard/integraciones');
    loginUrl.searchParams.set('reason', 'onedrive-auth');
    return NextResponse.redirect(loginUrl.toString(), { status: 302 });
  }

  const redirectPath = request.nextUrl.searchParams.get('redirect') ?? '/dashboard/integraciones';
  const state = createOneDriveOAuthState(user.id, redirectPath);

  const redirectUri = new URL('/api/oauth/onedrive/callback', origin).toString();
  const authorizationUrl = await buildOneDriveOAuthUrl({
    state,
    redirectUri,
  });

  return NextResponse.redirect(authorizationUrl, { status: 302 });
}
