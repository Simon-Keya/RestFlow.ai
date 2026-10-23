// apps/web/src/features/recipes/components/RecipeTable.tsx
"use client";

import Link from "next/link";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpen } from "lucide-react";
import { routes } from "@/lib/routes";
import type { Recipe } from "../types";

export function RecipeTable({
  shopId,
  recipes,
}: {
  shopId: string;
  recipes: Recipe[];
}) {
  const list = recipes ?? [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No recipes yet"
        description="Create a recipe to run production batches and track food cost."
      />
    );
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Category</TableHeaderCell>
          <TableHeaderCell>Finished SKU</TableHeaderCell>
          <TableHeaderCell className="text-right">Yield</TableHeaderCell>
          <TableHeaderCell className="text-right">Ingredients</TableHeaderCell>
          <TableHeaderCell className="text-right">Outputs</TableHeaderCell>
          <TableHeaderCell>Recipe ID</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {list.map((recipe) => (
          <TableRow key={recipe.recipeId}>
            <TableCell className="font-medium">
              <Link
                href={routes.recipe(shopId, recipe.recipeId)}
                className="text-primary-700 hover:underline"
              >
                {recipe.name}
              </Link>
            </TableCell>
            <TableCell className="text-ink-muted">
              {recipe.category?.trim() || "—"}
            </TableCell>
            <TableCell className="text-ink-muted">{recipe.itemId}</TableCell>
            <TableCell className="text-right tabular-nums">
              {recipe.standardYield} {recipe.unit}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {recipe.ingredients?.length ?? 0}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {recipe.outputs?.length ?? 0}
            </TableCell>
            <TableCell className="text-xs text-ink-faint">
              {recipe.recipeId}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
