"use client";

import Link from "next/link";
import { Store } from "lucide-react";
import { useShopId } from "@/hooks/use-shop-id";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

export interface Branch {
  id: string;
  name: string;
}

export interface BranchTabNavProps {
  /** Shops the signed-in user can switch between. Defaults to just the current shop when a
   *  multi-shop directory isn't wired up yet (see the audit note: multi-tenancy is still
   *  single-shop-only on the API today). */
  branches?: Branch[];
}

export function BranchTabNav({ branches }: BranchTabNavProps) {
  const shopId = useShopId();
  const list = branches ?? [{ id: shopId, name: `Shop ${shopId}` }];

  if (list.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-4">
      {list.map((branch) => {
        const active = branch.id === shopId;
        return (
          <Link
            key={branch.id}
            href={routes.dashboard(branch.id)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-primary-600 text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            <Store className="h-3.5 w-3.5" aria-hidden />
            {branch.name}
          </Link>
        );
      })}
    </div>
  );
}
