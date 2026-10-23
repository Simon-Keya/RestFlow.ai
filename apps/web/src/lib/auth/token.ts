// apps/web/src/lib/auth/token.ts
"use client";

import { AUTH_COOKIE_NAME } from "@/lib/constants/storage-keys";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // align with API JWT_EXPIRES_IN (e.g. 7d)

function cookieSecureFlag(): string {
  if (typeof window === "undefined") return "";
  return window.location.protocol === "https:" ? "; Secure" : "";
}

export function setAuthToken(token: string) {
  document.cookie =
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax` +
    cookieSecureFlag();
}

export function clearAuthToken() {
  document.cookie =
    `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax` + cookieSecureFlag();
}

export function readAuthTokenClient(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${AUTH_COOKIE_NAME}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}