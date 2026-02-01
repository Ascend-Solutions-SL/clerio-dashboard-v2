export type FacturaRow = {
  id: number;
  numero: string;
  fecha: string;
  tipo: string;
  empresa_id: number | null;
  cliente_proveedor: string;
  concepto: string | null;
  importe_sin_iva: number | null;
  iva: number | null;
  estado_pago: string;
  estado_proces: string | null;
  drive_file_id: string | null;
  drive_type?: string | null;
  drive_file_name: string | null;
  user_businessname: string | null;
  factura_uid: string | null;
  importe_total: number | null;
};

export const COMPARABLE_FACTURA_FIELDS = [
  'numero',
  'fecha',
  'tipo',
  'empresa_id',
  'cliente_proveedor',
  'concepto',
  'importe_sin_iva',
  'iva',
  'estado_pago',
  'estado_proces',
  'drive_file_id',
  'drive_file_name',
  'user_businessname',
  'factura_uid',
  'importe_total',
] as const;

export type ComparableFacturaField = (typeof COMPARABLE_FACTURA_FIELDS)[number];

export type FieldDiff = {
  field: ComparableFacturaField;
  a: FacturaRow[ComparableFacturaField];
  b: FacturaRow[ComparableFacturaField];
  equal: boolean;
  delta: number | null;
};

export type FacturaComparison = {
  factura_uid: string;
  a: FacturaRow;
  b: FacturaRow;
  diffs: FieldDiff[];
  diffCount: number;
  hasDiffs: boolean;
  hasTotalDiff: boolean;
};

const asNumber = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const normalizeValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '';
  }
  return value;
};

const valuesEqual = (a: unknown, b: unknown) => {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);

  if (na === null && nb === null) {
    return true;
  }

  const an = asNumber(na);
  const bn = asNumber(nb);

  if (an !== null && bn !== null) {
    return Math.abs(an - bn) < 0.005;
  }

  const sa = String(na ?? '').trim().toLowerCase();
  const sb = String(nb ?? '').trim().toLowerCase();
  return sa === sb;
};

export const compareFacturas = (factura_uid: string, a: FacturaRow, b: FacturaRow): FacturaComparison => {
  const diffs: FieldDiff[] = COMPARABLE_FACTURA_FIELDS.map((field) => {
    const av = a[field];
    const bv = b[field];
    const an = asNumber(av);
    const bn = asNumber(bv);

    return {
      field,
      a: av,
      b: bv,
      equal: valuesEqual(av, bv),
      delta: an !== null && bn !== null ? bn - an : null,
    };
  });

  const diffCount = diffs.filter((d) => !d.equal).length;
  const hasTotalDiff = diffs.some((d) => d.field === 'importe_total' && !d.equal);

  return {
    factura_uid,
    a,
    b,
    diffs,
    diffCount,
    hasDiffs: diffCount > 0,
    hasTotalDiff,
  };
};

export const formatValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return String(value);
};

export const computeStatus = (comparison: FacturaComparison): 'ok' | 'warn' | 'bad' => {
  if (!comparison.hasDiffs) {
    return 'ok';
  }

  if (comparison.hasTotalDiff || comparison.diffCount >= 4) {
    return 'bad';
  }

  return 'warn';
};

export const buildAutoSummary = (comparison: FacturaComparison): string[] => {
  const summary: string[] = [];

  const totalDiff = comparison.diffs.find((d) => d.field === 'importe_total' && !d.equal);
  if (totalDiff) {
    summary.push(`Importe total no coincide (Δ ${(totalDiff.delta ?? 0).toFixed(2)})`);
  }

  const ivaDiff = comparison.diffs.find((d) => d.field === 'iva' && !d.equal);
  if (ivaDiff) {
    summary.push(`IVA no coincide (Δ ${(ivaDiff.delta ?? 0).toFixed(2)})`);
  }

  const baseDiff = comparison.diffs.find((d) => d.field === 'importe_sin_iva' && !d.equal);
  if (baseDiff) {
    summary.push(`Base imponible no coincide (Δ ${(baseDiff.delta ?? 0).toFixed(2)})`);
  }

  const tipoDiff = comparison.diffs.find((d) => d.field === 'tipo' && !d.equal);
  if (tipoDiff) {
    summary.push('Tipo (Ingresos/Gastos) no coincide');
  }

  const estadoDiff = comparison.diffs.find((d) => d.field === 'estado_pago' && !d.equal);
  if (estadoDiff) {
    summary.push('Estado de pago no coincide');
  }

  const counterpartDiff = comparison.diffs.find((d) => d.field === 'cliente_proveedor' && !d.equal);
  if (counterpartDiff) {
    summary.push('Cliente/Proveedor no coincide');
  }

  const conceptoDiff = comparison.diffs.find((d) => d.field === 'concepto' && !d.equal);
  if (conceptoDiff) {
    summary.push('Concepto no coincide');
  }

  if (summary.length === 0 && comparison.hasDiffs) {
    summary.push(`Se detectan ${comparison.diffCount} diferencias`);
  }

  return summary;
};
