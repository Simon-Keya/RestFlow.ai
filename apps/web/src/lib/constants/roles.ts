/**
 * Mirrors the `Role` values used by the RestFlow API (see apps/api `@Roles()` decorators).
 * Keep this list in sync with the backend — it's duplicated here rather than shared via a
 * package because apps/web has no workspace package to pull it from yet.
 */
export const ROLES = ["ADMIN", "MANAGER", "KITCHEN", "POS"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  KITCHEN: "Kitchen staff",
  POS: "Front of house",
};

/** Roles allowed to see and act on cost/variance/approval data, not just operational screens. */
export const FINANCE_ROLES: Role[] = ["ADMIN", "MANAGER"];
