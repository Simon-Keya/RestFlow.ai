export type TeamRole = "ADMIN" | "MANAGER" | "KITCHEN" | "POS";

export interface TeamUser {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
  shop_id: string;
  is_active: boolean;
  created_at: string;
}
