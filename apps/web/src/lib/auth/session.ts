import type { Role } from "@/lib/constants/roles";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  name?: string;
  exp: number;
  iat: number;
}

/**
 * Decodes the JWT payload for *display purposes only* (name/role in the UI). This never
 * verifies the signature — the API is always the source of truth for authorization; the
 * decoded payload here just avoids an extra round trip to render "Signed in as ...".
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now();
}

export function sessionUserFromToken(token: string): SessionUser | null {
  const payload = decodeJwt(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    role: payload.role,
  };
}
