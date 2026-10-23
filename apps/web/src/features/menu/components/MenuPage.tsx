"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { RoleGate } from "@/components/layout/RoleGate";
import { useMenu } from "../hooks/use-menu";
import { MenuSkeleton } from "./MenuSkeleton";
import { MenuTable } from "./MenuTable";
import { CreateMenuModal } from "./CreateMenuModal";

export function MenuPage({ shopId }: { shopId: string }) {
  const [open, setOpen] = useState(false);
  const query = useMenu(shopId);

  if (query.isPending) return <MenuSkeleton />;

  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load menu"
        description={query.error.message}
        onRetry={query.refetch}
      />
    );
  }

  const items = query.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Menu (legacy / FG components)"
        description="Ready meals and sellable items linked to finished goods. Use Catalog above for recipe/stocked items, categories, and combos."
        actions={
          <RoleGate allow={["ADMIN"]}>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add menu item
            </Button>
          </RoleGate>
        }
      />

      <Card>
        <MenuTable items={items} />
      </Card>

      <CreateMenuModal open={open} onOpenChange={setOpen} shopId={shopId} />
    </div>
  );
}
