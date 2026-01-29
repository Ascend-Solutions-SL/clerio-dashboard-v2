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
  const qRaw = searchParams.get('q');
  const startRaw = searchParams.get('start');
  const endRaw = searchParams.get('end');

  const page = Math.max(1, Number(pageRaw ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(limitRaw ?? '30') || 30));
  const q = (qRaw ?? '').trim();
  const start = (startRaw ?? '').trim();
  const end = (endRaw ?? '').trim();

  const from = (page - 1) * limit;
  const to = from + limit; // fetch one extra row to compute hasMore

  let query = supabaseAdmin
    .from('logs')
    .select('id, created_at, log, user_uid, user_businessname')
    .order('id', { ascending: false });

  if (q) {
    const escaped = q.replace(/,/g, ' ');
    query = query.or(`user_uid.ilike.%${escaped}%,user_businessname.ilike.%${escaped}%`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    query = query.gte('created_at', `${start}T00:00:00.000Z`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    const [y, m, d] = end.split('-').map((v) => Number(v));
    const endDate = new Date(Date.UTC(y, m - 1, d));
    const endExclusive = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    query = query.lt('created_at', endExclusive.toISOString());
  }

  const { data, error } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const logs = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json({ logs, page, limit, hasMore, q, start, end });
}
