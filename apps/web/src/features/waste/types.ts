export type WasteCause =
  | "expired"
  | "spoiled"
  | "prep_error"
  | "customer_return"
  | "overproduction"
  | "other";

export interface WasteSummary {
  totalWastedValue: number;
  totalWastedQuantity: number;
  wastePercentOfPurchases: number | null;
  byCause: Array<{ cause: WasteCause; value: number; quantity: number }>;
}

export interface TopWastedItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  value: number;
  incidentCount: number;
}

export interface WasteEvent {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  cause: WasteCause;
  value: number;
  reportedBy: string;
  moduleSource: string;
  createdAt: string;
  photoUrl?: string | null;
  notes?: string | null;
  rejected?: boolean;
  batchNumber?: string | null;
}