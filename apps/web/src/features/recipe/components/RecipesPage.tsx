"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { RoleGate } from "@/components/layout/RoleGate";
import { routes } from "@/lib/routes";
import { RECIPE_CATEGORIES } from "../constants";
import { useRecipes } from "../hooks/use-recipes";
import { RecipeTable } from "./RecipeTable";

export function RecipesPage({ shopId }: { shopId: string }) {
  const recipes = useRecipes(shopId);
  const [categoryFilter, setCategoryFilter] = useState("");

  const list = useMemo(() => {
    const all = recipes.data ?? [];
    if (!categoryFilter.trim()) return all;
    return all.filter(
      (r) =>
        (r.category ?? "").toLowerCase() === categoryFilter.trim().toLowerCase(),
    );
  }, [recipes.data, categoryFilter]);

  if (recipes.isPending) {
    return <FullPageSpinner label="Loading recipes…" />;
  }

  if (recipes.isError) {
    return (
      <ErrorState
        title="Couldn't load recipes"
        description={recipes.error.message}
        onRetry={recipes.refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recipes"
        description="Bills of materials for production and food cost."
        actions={
          <RoleGate allow={["ADMIN"]}>
            <Button asChild>
              <Link href={routes.recipeNew(shopId)}>
                <Plus className="h-4 w-4" /> Create recipe
              </Link>
            </Button>
          </RoleGate>
        }
      />

      <div className="flex max-w-xs flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">Category</label>
        <Select
          value={categoryFilter}
          onValueChange={setCategoryFilter}
          options={[
            { value: "", label: "All categories" },
            ...RECIPE_CATEGORIES.map((c) => ({
              value: c.value,
              label: c.label,
            })),
          ]}
        />
      </div>

      <Card>
        <RecipeTable shopId={shopId} recipes={list} />
      </Card>
    </div>
  );
}