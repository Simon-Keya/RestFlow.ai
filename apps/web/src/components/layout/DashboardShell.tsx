"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AppSidebar, NAV_ITEMS } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { UserMenu } from "./UserMenu";
import { useShopId } from "@/hooks/use-shop-id";
import { useAuthStore } from "@/store/auth";
import { useUiStore } from "@/store/ui";
import { canAccess } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/constants/config";

function MobileNav() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  const shopId = useShopId();
  const role = useAuthStore((s) => s.user?.role);
  const pathname = usePathname();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 md:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface md:hidden">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <span className="font-display text-sm font-semibold text-ink">{APP_NAME}</span>
            <Dialog.Close className="rounded p-1.5 text-ink-faint hover:bg-surface-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {NAV_ITEMS.filter((item) => canAccess(item.section, role)).map((item) => {
              const href = item.href(shopId);
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.section}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                    active ? "bg-primary-50 text-primary-700" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <UserMenu />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The dashboard chrome — sidebar (desktop) / drawer (mobile) + topbar (mobile) + scrollable content well. Mounted once by `(dashboard)/shop/[shopId]/dashboard/layout.tsx`. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      <AppSidebar />
      <MobileNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
