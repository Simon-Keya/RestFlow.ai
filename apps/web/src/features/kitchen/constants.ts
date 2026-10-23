export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

export const KITCHEN_TABS = [
  { value: "queue", label: "Production queue" },
  { value: "recipes", label: "Recipe availability" },
  { value: "refills", label: "Refill requests" },
  { value: "closing-stock", label: "Closing stock" },
] as const;
