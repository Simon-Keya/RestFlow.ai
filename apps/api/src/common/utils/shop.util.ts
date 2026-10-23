/**
 * Server-side shop resolution.
 * Never trust client shopId alone — validate against the authenticated user.
 */

export type ShopScopedUser = {
  id?: string;
  role?: string;
  shopId?: string | null;
  shop_id?: string | null;
};

export function userShopId(user?: ShopScopedUser | null): string {
  if (!user) return '1';
  const raw = user.shopId ?? user.shop_id;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return '1';
}

/**
 * Resolve the effective shop for a request.
 * - ADMIN may access any requested shop (or default to their own).
 * - All other roles must match their membership; mismatch → null (caller forbids).
 */
export function resolveShopId(
  user: ShopScopedUser | null | undefined,
  clientShopId?: string | null,
): { shopId: string; allowed: boolean } {
  const membership = userShopId(user);
  const requested =
    typeof clientShopId === 'string' && clientShopId.trim()
      ? clientShopId.trim()
      : membership;

  const role = (user?.role ?? '').toUpperCase();
  if (role === 'ADMIN') {
    return { shopId: requested, allowed: true };
  }

  if (requested !== membership) {
    return { shopId: membership, allowed: false };
  }

  return { shopId: membership, allowed: true };
}

/** Pick first present client-supplied shop hint from common query/body shapes. */
export function pickClientShopId(source: {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
}): string | undefined {
  const pools = [source.query, source.body, source.params];
  for (const pool of pools) {
    if (!pool) continue;
    for (const key of ['shopId', 'shop_id']) {
      const v = pool[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return undefined;
}
