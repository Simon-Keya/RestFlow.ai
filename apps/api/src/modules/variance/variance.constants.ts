// apps/api/src/modules/variance/variance.constants.ts

/** Default |variance %| above which a batch is auto-flagged */
export const DEFAULT_VARIANCE_TOLERANCE_PERCENT = Number(
  process.env.VARIANCE_TOLERANCE_PERCENT ?? 5,
);

export const VARIANCE_REASON_CODES = [
  'spoilage',
  'theft',
  'recipe_error',
  'weighing_error',
  'portioning',
  'supplier_short',
  'other',
] as const;

export type VarianceReasonCode = (typeof VARIANCE_REASON_CODES)[number];
