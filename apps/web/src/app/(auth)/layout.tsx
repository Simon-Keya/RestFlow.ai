export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Deliberately minimal — LoginPage owns its own centered card layout, so this group layout
  // exists mainly to keep (auth) as a sibling of (dashboard) for route-level clarity.
  return <>{children}</>;
}
