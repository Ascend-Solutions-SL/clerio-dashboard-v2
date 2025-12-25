import { NextRequest, NextResponse } from 'next/server';

import { buildGoogleOAuthUrl, createOAuthState } from '@/lib/google/gmailOAuth';
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
    loginUrl.searchParams.set('reason', 'gmail-auth');
    return NextResponse.redirect(loginUrl.toString(), { status: 302 });
  }

  const redirectPath = request.nextUrl.searchParams.get('redirect') ?? '/dashboard/integraciones';
  const state = createOAuthState(user.id, redirectPath);

  const redirectUri = new URL('/api/gmail/oauth/callback', origin).toString();
  const authorizationUrl = buildGoogleOAuthUrl({
    state,
    redirectUri,
  });

  return NextResponse.redirect(authorizationUrl, { status: 302 });
}
