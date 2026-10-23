export const ORDER_STATUS_TONE: Record<
  string,
  "neutral" | "warning" | "success" | "danger"
> = {
  not_sent: "neutral",
  pending: "neutral",
  preparing: "warning",
  ready: "success",
  served: "success",
  completed: "success",
  cancelled: "danger",
  sent_to_kitchen: "warning",
};

export const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "Dine in",
  "dine-in": "Dine in",
  takeaway: "Takeaway",
  delivery: "Delivery",
  pickup: "Pickup",
};

export const PAYMENT_STATUS_TONE: Record<
  string,
  "neutral" | "warning" | "success" | "danger"
> = {
  unpaid: "neutral",
  pending: "warning",
  paid: "success",
  failed: "danger",
};
