import { NextRequest, NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const guard = await requireMasterUser();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { searchParams } = request.nextUrl;
  const pageRaw = searchParams.get('page');
  const limitRaw = searchParams.get('limit');

  const page = Math.max(1, Number(pageRaw ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(limitRaw ?? '30') || 30));

  const from = (page - 1) * limit;
  const to = from + limit; // fetch one extra row to compute hasMore

  const { data, error } = await supabaseAdmin
    .from('logs')
    .select('id, created_at, log')
    .order('id', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const logs = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json({ logs, page, limit, hasMore });
}
