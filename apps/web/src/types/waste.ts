export type WasteCause = "expired" | "spoiled" | "prep_error" | "customer_return" | "overproduction" | "other";

export interface WasteSummary {
  totalWastedValue: number;
  totalWastedQuantity: number;
  wastePercentOfPurchases: number | null;
  byCause: { cause: WasteCause; value: number; quantity: number }[];
}

export interface TopWastedItem {
  itemId: string;
  name: string;
  quantity: number;
  unit: string;
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
}
