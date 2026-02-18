export const MASTER_ANALYSIS_VISIBLE_FIELDS = [
  'numero',
  'tipo',
  'buyer_name',
  'buyer_tax_id',
  'seller_name',
  'seller_tax_id',
  'iva',
  'importe_sin_iva',
  'importe_total',
  'fecha',
  'invoice_concept',
  'invoice_reason',
  'user_businessname',
] as const;

export const MASTER_ANALYSIS_SCORING_FIELDS = MASTER_ANALYSIS_VISIBLE_FIELDS.filter(
  (f) => f !== 'invoice_concept' && f !== 'invoice_reason' && f !== 'user_businessname'
) as readonly string[];
