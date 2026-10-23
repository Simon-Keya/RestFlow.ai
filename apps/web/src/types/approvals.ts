export interface PendingApproval {
  id: string;
  type: "receiving" | "waste_writeoff" | "stock_adjustment" | "variance_writeoff" | "refund";
  summary: string;
  amount: number;
  requestedBy: string;
  requestedAt: string;
  itemId?: string | null;
}
