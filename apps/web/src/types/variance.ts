export interface VarianceBatch {
  batchId: string;
  countedBy: string;
  countedAt: string;
  status: "open" | "reviewed" | "flagged";
  itemsCounted: number;
  itemsFlagged: number;
  totalVarianceValue: number;
}

export interface VarianceLine {
  itemId: string;
  itemName: string;
  unit: string;
  expectedQuantity: number;
  countedQuantity: number;
  varianceQuantity: number;
  varianceValue: number;
  reasonCode?: string | null;
}

export const REASON_CODES = [
  "miscount",
  "theft_suspected",
  "unrecorded_waste",
  "unrecorded_transfer",
  "portioning_drift",
  "other",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
