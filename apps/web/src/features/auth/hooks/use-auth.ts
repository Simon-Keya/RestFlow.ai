"use client";

import { useAuthStore } from "@/store/auth";

/** Convenience read hook — thin wrapper so components don't reach into the store shape directly. */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  return { user, isAuthenticated: status === "authenticated", isLoading: status === "idle" };
}
