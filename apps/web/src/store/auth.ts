import { create } from "zustand";
import type { SessionUser } from "@/lib/auth/session";

interface AuthState {
  user: SessionUser | null;
  status: "idle" | "authenticated" | "unauthenticated";
  setUser: (user: SessionUser | null) => void;
  reset: () => void;
}

/**
 * Holds the *decoded* session for synchronous access in components (sidebar greeting, role
 * gates, etc). The token itself lives in a cookie (`src/lib/auth/token.ts`); this store never
 * touches storage directly so it stays trivially testable.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  setUser: (user) => set({ user, status: user ? "authenticated" : "unauthenticated" }),
  reset: () => set({ user: null, status: "unauthenticated" }),
}));
