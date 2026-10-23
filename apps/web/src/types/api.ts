/** Generic envelope some list endpoints wrap responses in; most return the array/object directly. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface EventRecord {
  id: string;
  event_type: string;
  shop_id: string;
  item_id?: string | null;
  actor_user_id?: string | null;
  quantity?: number | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  batch_number?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}
