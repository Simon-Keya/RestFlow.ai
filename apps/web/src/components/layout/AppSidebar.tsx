// apps/web/src/components/layout/AppSidebar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Package,
  ChefHat,
  BookOpen,
  UtensilsCrossed,
  ShoppingCart,
  Trash2,
  TrendingDown,
  ClipboardList,
  Search,
  ShieldCheck,
  UsersRound,
  ChevronsLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useShopId } from "@/hooks/use-shop-id";
import { useAuthStore } from "@/store/auth";
import { useUiStore } from "@/store/ui";
import { canAccess, type Section } from "@/lib/permissions";
import { routes } from "@/lib/routes";
import { UserMenu } from "./UserMenu";
import { APP_NAME } from "@/lib/constants/config";

interface NavItem {
  section: Section;
  label: string;
  icon: typeof LayoutDashboard;
  href: (shopId: string) => string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    section: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: routes.dashboard,
  },
  {
    section: "inventory",
    label: "Inventory",
    icon: Boxes,
    href: routes.inventory,
  },
  {
    section: "finishedGoods",
    label: "Finished goods",
    icon: Package,
    href: routes.finishedGoods,
  },
  {
    section: "kitchen",
    label: "Kitchen",
    icon: ChefHat,
    href: routes.kitchen,
  },
  {
    section: "recipes",
    label: "Recipes",
    icon: BookOpen,
    href: routes.recipes,
  },
  {
    section: "menu",
    label: "Menu",
    icon: UtensilsCrossed,
    href: routes.menu,
  },
  {
    section: "pos",
    label: "POS",
    icon: ShoppingCart,
    href: routes.pos,
  },
  {
    section: "waste",
    label: "Waste",
    icon: Trash2,
    href: routes.waste,
  },
  {
    section: "consumption",
    label: "Consumption",
    icon: TrendingDown,
    href: routes.consumption,
  },
  {
    section: "variance",
    label: "Variance",
    icon: ClipboardList,
    href: routes.variance,
  },
  {
    section: "approvals",
    label: "Approvals",
    icon: ShieldCheck,
    href: routes.approvals,
  },
  {
    section: "team",
    label: "Team",
    icon: UsersRound,
    href: routes.team,
  },
  {
    section: "trace",
    label: "Trace",
    icon: Search,
    href: routes.trace,
  },
  {
    section: "assistant",
    label: "AI Assistant",
    icon: Sparkles,
    href: routes.assistant,
  },
];

export function AppSidebar() {
  const shopId = useShopId();
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-150 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Image
          src="/logo.svg"
          alt=""
          width={26}
          height={26}
          className="shrink-0"
        />
        {!collapsed && (
          <span className="font-display text-sm font-semibold text-ink">
            {APP_NAME}
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.filter((item) => canAccess(item.section, role)).map(
          (item) => {
            const href = item.href(shopId);
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.section}
                href={href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          },
        )}
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-ink-faint transition hover:bg-surface-muted"
      >
        <ChevronsLeft
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            collapsed && "rotate-180",
          )}
        />
        {!collapsed && "Collapse"}
      </button>

      <UserMenu />
    </aside>
  );
}
