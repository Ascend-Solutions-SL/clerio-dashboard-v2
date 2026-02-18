import { NextResponse } from 'next/server';

import { requireMasterUser } from '@/lib/master';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { MASTER_ANALYSIS_SCORING_FIELDS } from '@/lib/master/analysisFields';

type FieldMetric = {
  field: string;
  correct: number;
  incorrect: number;
  unset: number;
  total: number;
  reviewed: number;
  coveragePct: number;
  accuracyPct: number;
};

type Totals = {
  totalFacturas: number;
  withReview: number;
  completeReviews: number;
  perfect: number;
  overallAccuracyPct: number | null;
};

export async function GET() {
  const guard = await requireMasterUser();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: guard.status });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const scoringFields = MASTER_ANALYSIS_SCORING_FIELDS as readonly string[];

  const { data: facturaRowsRaw, error: facturaError } = await supabaseAdmin
    .from('facturas')
    .select('factura_uid')
    .order('id', { ascending: false })
    .limit(2000);

  if (facturaError) {
    return NextResponse.json({ error: facturaError.message }, { status: 500 });
  }

  const uids = Array.from(
    new Set(
      ((facturaRowsRaw as unknown as { factura_uid?: unknown }[] | null) ?? [])
        .map((r) => (typeof r.factura_uid === 'string' ? r.factura_uid : ''))
        .filter(Boolean)
    )
  );

  const { data: reviewRowsRaw, error: reviewError } = await supabaseAdmin
    .from('factura_comparison_reviews')
    .select('factura_uid, tool_a')
    .in('factura_uid', uids);

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  type ValidationState = 'unset' | 'correct' | 'incorrect';
  const isValidationState = (v: unknown): v is ValidationState => v === 'unset' || v === 'correct' || v === 'incorrect';

  const sanitizeMap = (value: unknown): Record<string, ValidationState> => {
    if (!value || typeof value !== 'object') {
      return {};
    }
    const out: Record<string, ValidationState> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof k === 'string' && isValidationState(v)) {
        out[k] = v;
      }
    }
    return out;
  };

  const reviewMap = new Map<string, Record<string, ValidationState>>();
  for (const r of (reviewRowsRaw as unknown as { factura_uid?: unknown; tool_a?: unknown }[]) ?? []) {
    const uid = typeof r.factura_uid === 'string' ? r.factura_uid : '';
    if (!uid) {
      continue;
    }
    reviewMap.set(uid, sanitizeMap(r.tool_a));
  }

  const totals: Totals = {
    totalFacturas: uids.length,
    withReview: 0,
    completeReviews: 0,
    perfect: 0,
    overallAccuracyPct: null,
  };

  const fieldCounts = Object.fromEntries(
    scoringFields.map((f) => [f, { correct: 0, incorrect: 0, unset: 0 }])
  ) as Record<string, { correct: number; incorrect: number; unset: number }>;

  let sumReviewed = 0;
  let sumCorrect = 0;

  for (const uid of uids) {
    const validation = reviewMap.get(uid) ?? null;
    if (!validation) {
      continue;
    }
    totals.withReview += 1;

    let allSet = true;
    let reviewed = 0;
    let correct = 0;

    for (const f of scoringFields) {
      const v = (validation[f] ?? 'unset') as ValidationState;
      if (v === 'correct') {
        fieldCounts[f].correct += 1;
        reviewed += 1;
        correct += 1;
      } else if (v === 'incorrect') {
        fieldCounts[f].incorrect += 1;
        reviewed += 1;
      } else {
        fieldCounts[f].unset += 1;
        allSet = false;
      }
    }

    if (allSet) {
      totals.completeReviews += 1;
      if (reviewed > 0 && correct === reviewed) {
        totals.perfect += 1;
      }
    }

    sumReviewed += reviewed;
    sumCorrect += correct;
  }

  totals.overallAccuracyPct = sumReviewed > 0 ? (sumCorrect / sumReviewed) * 100 : null;

  const fields: FieldMetric[] = scoringFields
    .map((field) => {
      const c = fieldCounts[field];
      const total = c.correct + c.incorrect + c.unset;
      const reviewed = c.correct + c.incorrect;
      const coveragePct = total > 0 ? (reviewed / total) * 100 : 0;
      const accuracyPct = reviewed > 0 ? (c.correct / reviewed) * 100 : 0;
      return {
        field,
        correct: c.correct,
        incorrect: c.incorrect,
        unset: c.unset,
        total,
        reviewed,
        coveragePct,
        accuracyPct,
      };
    })
    .sort((a, b) => a.accuracyPct - b.accuracyPct);

  return NextResponse.json({ totals, fields });
}
