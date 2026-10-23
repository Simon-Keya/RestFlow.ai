// apps/web/src/lib/permissions.ts
import type { Role } from "@/lib/constants/roles";

/**
 * Section-level permission map (nav visibility).
 * Mutation rules are separate helpers (canEditMenu, canEditRecipe, …).
 *
 * Michael / product rules:
 * - Team: ADMIN only (managers must not access team module)
 * - Menu: visible to ops for read; only ADMIN can create/edit/update
 * - Recipes: visible to kitchen/manager for read; only ADMIN can create/edit/update
 */
export const SECTION_PERMISSIONS = {
  dashboard: ["ADMIN", "MANAGER", "KITCHEN", "POS"],
  inventory: ["ADMIN", "MANAGER", "KITCHEN"],
  finishedGoods: ["ADMIN", "MANAGER", "KITCHEN"],
  kitchen: ["ADMIN", "MANAGER", "KITCHEN"],
  recipes: ["ADMIN", "MANAGER", "KITCHEN"],
  menu: ["ADMIN", "MANAGER", "POS", "KITCHEN"],
  pos: ["ADMIN", "MANAGER", "POS"],
  waste: ["ADMIN", "MANAGER", "KITCHEN"],
  consumption: ["ADMIN", "MANAGER"],
  variance: ["ADMIN", "MANAGER"],
  approvals: ["ADMIN", "MANAGER"],
  trace: ["ADMIN", "MANAGER"],
  /** Team module — ADMIN only */
  team: ["ADMIN"],
  /** AI Operations Assistant — read-only tools; Nest enforces data access */
  assistant: ["ADMIN", "MANAGER", "KITCHEN", "POS"],
} as const satisfies Record<string, Role[]>;

export type Section = keyof typeof SECTION_PERMISSIONS;

export function canAccess(
  section: Section,
  role: Role | undefined | null,
): boolean {
  if (!role) return false;
  return (SECTION_PERMISSIONS[section] as readonly Role[]).includes(role);
}

/** Only ADMIN may create/edit menu catalog (items, categories, combos). */
export function canEditMenu(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}

/** Only ADMIN may create/edit recipes (MANAGER is read-only on recipe pages). */
export function canEditRecipe(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}

/** Only ADMIN may change another user's role / open Team module. */
export function canChangeUserRole(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}

/** KITCHEN never uses POS. */
export function canUsePos(role: Role | undefined | null): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "POS";
}

export function landingSectionFor(role: Role): Section {
  if (role === "POS") return "pos";
  if (role === "KITCHEN") return "kitchen";
  return "dashboard";
}

/** Only ADMIN and MANAGER may finalize/submit closing stock counts. */
export function canSubmitClosingStock(role: Role | undefined | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}
