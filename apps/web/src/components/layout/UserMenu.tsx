"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { clearAuthToken } from "@/lib/auth/token";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { routes } from "@/lib/routes";

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);
  const router = useRouter();

  function handleLogout() {
    clearAuthToken();
    reset();
    router.replace(routes.login());
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-3 border-t border-border px-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
        <User className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{user.name}</p>
        <p className="truncate text-xs text-ink-muted">{ROLE_LABELS[user.role]}</p>
      </div>
      <button
        onClick={handleLogout}
        className="rounded p-1.5 text-ink-faint transition hover:bg-surface-muted hover:text-ink"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
