"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { readAuthTokenClient, clearAuthToken } from "@/lib/auth/token";
import { isTokenExpired, sessionUserFromToken } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

/**
 * Hydrates the auth store from the cookie on first client render, and keeps it in sync if the
 * token disappears (logout in another tab, 401 redirect, etc). Route-level protection itself
 * lives in `middleware.ts` — this provider is about giving components synchronous access to
 * "who's logged in", not about gatekeeping.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();

  useEffect(() => {
    const token = readAuthTokenClient();
    if (!token || isTokenExpired(token)) {
      clearAuthToken();
      setUser(null);
      return;
    }
    setUser(sessionUserFromToken(token));
  }, [setUser]);

  useEffect(() => {
    function onStorageOrFocus() {
      const token = readAuthTokenClient();
      if (!token) {
        setUser(null);
        router.replace(routes.login());
      }
    }
    window.addEventListener("focus", onStorageOrFocus);
    return () => window.removeEventListener("focus", onStorageOrFocus);
  }, [router, setUser]);

  return <>{children}</>;
}
