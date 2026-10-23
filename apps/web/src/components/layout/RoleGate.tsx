"use client";

import { useAuthStore } from "@/store/auth";
import type { Role } from "@/lib/constants/roles";

export interface RoleGateProps {
  allow: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Hides (or swaps in a fallback for) UI the current user's role shouldn't see — a component-level complement to the route-level checks in `middleware.ts` and `canAccess()`. */
export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || !allow.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
