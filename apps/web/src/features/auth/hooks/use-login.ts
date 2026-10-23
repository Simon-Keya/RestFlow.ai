"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "../api";
import type { LoginInput } from "../schema";
import { setAuthToken } from "@/lib/auth/token";
import { sessionUserFromToken } from "@/lib/auth/session";
import { useAuthStore } from "@/store/auth";
import { landingSectionFor } from "@/lib/permissions";
import { routes } from "@/lib/routes";
import { toApiError } from "@/lib/api/errors";

/** Default shop until a real "which shops can this user access" endpoint exists. */
const DEFAULT_SHOP_ID = "1";

export function useLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (response) => {
      setAuthToken(response.access_token);
      const sessionUser = sessionUserFromToken(response.access_token);
      setUser(sessionUser);

      const next = searchParams.get("next");
      const shopId = DEFAULT_SHOP_ID;
      if (next) {
        router.replace(next);
        return;
      }
      const section = landingSectionFor(response.user.role);
      const sectionRoute =
        section === "pos" ? routes.pos(shopId) : section === "kitchen" ? routes.kitchen(shopId) : routes.dashboard(shopId);
      router.replace(sectionRoute);
    },
    onError: (error) => toApiError(error),
  });
}
