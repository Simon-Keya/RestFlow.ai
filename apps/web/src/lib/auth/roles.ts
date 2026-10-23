import type { Role } from "@/lib/constants/roles";

export function hasRole(userRole: Role | undefined | null, allowed: Role[]): boolean {
  if (!userRole) return false;
  return allowed.includes(userRole);
}

export function isManagerOrAbove(role: Role | undefined | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}
