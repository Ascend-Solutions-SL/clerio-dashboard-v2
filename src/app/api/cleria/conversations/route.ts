import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .schema('public')
    .from('cleria_conversations')
    .select('id, title, updated_at')
    .eq('user_uid', user.id)
    .order('updated_at', { ascending: false });

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 });
  }

  return NextResponse.json(data);
}
