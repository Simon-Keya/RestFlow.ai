"use client";

import { Menu } from "lucide-react";
import { useUiStore } from "@/store/ui";
import { ShopContextBadge } from "./ShopContextBadge";
import { APP_NAME } from "@/lib/constants/config";

export function AppTopbar() {
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 md:hidden">
      <button
        onClick={() => setMobileNavOpen(true)}
        className="rounded p-1.5 text-ink-muted hover:bg-surface-muted"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className="font-display text-sm font-semibold text-ink">{APP_NAME}</span>
      <ShopContextBadge />
    </header>
  );
}
