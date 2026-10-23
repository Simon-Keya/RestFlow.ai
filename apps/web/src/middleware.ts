import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/constants/storage-keys";

/**
 * Edge-level route gating. Checks cookie presence and JWT `exp` (without verifying
 * signature — API still validates signature). Expired cookies are cleared so dashboard
 * queries do not fire with a dead token → Unauthorized noise.
 */
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    const segment = parts[1];
    if (!segment) return true;
    const payloadJson = atob(segment.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    // 30s skew
    return payload.exp * 1000 < Date.now() - 30_000;
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const raw = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const token = raw ? decodeURIComponent(raw) : null;
  const hasValidSession = Boolean(token) && !isJwtExpired(token!);

  const isLoginRoute = pathname.startsWith("/login");
  const isProtectedRoute = pathname.startsWith("/shop/");

  if (!hasValidSession && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const res = NextResponse.redirect(loginUrl);
    if (token) {
      res.cookies.set(AUTH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    }
    return res;
  }

  if (hasValidSession && isLoginRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)"],
};
