import { NextRequest, NextResponse } from 'next/server';

import { buildOutlookOAuthUrl, createOutlookOAuthState } from '@/lib/outlook/outlookOAuth';
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
    loginUrl.searchParams.set('reason', 'outlook-auth');
    return NextResponse.redirect(loginUrl.toString(), { status: 302 });
  }

  const redirectPath = request.nextUrl.searchParams.get('redirect') ?? '/integraciones';
  const state = createOutlookOAuthState(user.id, redirectPath);

  const redirectUri = new URL('/api/oauth/outlook/callback', origin).toString();
  const authorizationUrl = await buildOutlookOAuthUrl({
    state,
    redirectUri,
  });

  return NextResponse.redirect(authorizationUrl, { status: 302 });
}
