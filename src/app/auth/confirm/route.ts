import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const redirect = url.searchParams.get('redirect') ?? '/onboarding';

  if (!code) {
    const next = new URL('/login', url.origin);
    next.searchParams.set('redirect', redirect);
    next.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(next);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const next = new URL('/login', url.origin);
    next.searchParams.set('redirect', redirect);
    next.searchParams.set('error', 'access_denied');
    next.searchParams.set('error_code', error.code ?? 'unknown');
    next.searchParams.set('error_description', error.message ?? 'Error validando el enlace');
    return NextResponse.redirect(next);
  }

  const target = redirect.startsWith('/') ? redirect : '/onboarding';
  return NextResponse.redirect(new URL(target, url.origin));
}
