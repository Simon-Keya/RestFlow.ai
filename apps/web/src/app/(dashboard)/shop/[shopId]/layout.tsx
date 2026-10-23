/**
 * Thin pass-through for the `[shopId]` segment. Kept separate from `dashboard/layout.tsx` so
 * a future non-dashboard, shop-scoped route (e.g. shop settings) can sit alongside `dashboard/`
 * without inheriting the sidebar chrome.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
