"use client";

import { useRouter } from "next/navigation";
import { clearAuthToken } from "@/lib/auth/token";
import { useAuthStore } from "@/store/auth";
import { routes } from "@/lib/routes";

export function useLogout() {
  const router = useRouter();
  const reset = useAuthStore((s) => s.reset);

  return () => {
    clearAuthToken();
    reset();
    router.replace(routes.login());
  };
}
