import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

type ValidationState = 'unset' | 'correct' | 'incorrect';

function isValidationState(value: unknown): value is ValidationState {
  return value === 'unset' || value === 'correct' || value === 'incorrect';
}

function sanitizeMap(value: unknown): Record<string, ValidationState> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const out: Record<string, ValidationState> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof k !== 'string') {
      continue;
    }

    if (isValidationState(v)) {
      out[k] = v;
    }
  }

  return out;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const factura_uid = req.nextUrl.searchParams.get('factura_uid')?.trim() ?? '';
  if (!factura_uid) {
    return NextResponse.json({ error: 'Missing factura_uid' }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema('public')
    .from('factura_comparison_reviews')
    .select('factura_uid, tool_a, tool_b, updated_at')
    .eq('factura_uid', factura_uid)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    factura_uid,
    toolA: sanitizeMap(data?.tool_a),
    toolB: sanitizeMap(data?.tool_b),
    updatedAt: data?.updated_at ?? null,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        factura_uid?: unknown;
        toolA?: unknown;
        toolB?: unknown;
      }
    | null;

  const factura_uid = (typeof body?.factura_uid === 'string' ? body?.factura_uid : '').trim();
  if (!factura_uid) {
    return NextResponse.json({ error: 'Missing factura_uid' }, { status: 400 });
  }

  const toolA = sanitizeMap(body?.toolA);
  const toolB = sanitizeMap(body?.toolB);

  const { data: existing, error: existingError } = await supabase
    .schema('public')
    .from('factura_comparison_reviews')
    .select('tool_a, tool_b')
    .eq('factura_uid', factura_uid)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const mergedA = { ...(sanitizeMap((existing as { tool_a?: unknown } | null)?.tool_a) ?? {}), ...toolA };
  const mergedB = { ...(sanitizeMap((existing as { tool_b?: unknown } | null)?.tool_b) ?? {}), ...toolB };

  const { data, error } = await supabase
    .schema('public')
    .from('factura_comparison_reviews')
    .upsert(
      {
        factura_uid,
        tool_a: mergedA,
        tool_b: mergedB,
      },
      { onConflict: 'factura_uid' }
    )
    .select('updated_at')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updatedAt: data?.updated_at ?? null });
}
