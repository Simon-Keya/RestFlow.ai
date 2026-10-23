export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  // Route-group root. Auth gating happens in `middleware.ts` before any of this renders;
  // this layer exists purely for route organization, not to duplicate that check.
  return <>{children}</>;
}
