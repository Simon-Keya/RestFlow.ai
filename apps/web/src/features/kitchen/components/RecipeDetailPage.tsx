// apps/web/src/features/kitchen/components/RecipeDetailPage.tsx
"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { formatCurrency } from "@/lib/format/currency";
import { formatQuantity } from "@/lib/format/numbers";
import { routes } from "@/lib/routes";
import { useRecipeDetail } from "../hooks/use-recipe-detail";

type RecipeOutputRow = {
  itemId: string;
  itemName: string;
  standardQuantity: number | null;
  unit: string;
  isDefault?: boolean;
};

export function RecipeDetailPage({
  shopId,
  recipeId,
}: {
  shopId: string;
  recipeId: string;
}) {
  const recipe = useRecipeDetail(recipeId);

  if (recipe.isPending) {
    return <FullPageSpinner label="Loading recipe…" />;
  }

  if (recipe.isError) {
    return (
      <ErrorState
        title="Couldn't load this recipe"
        description={recipe.error.message}
        onRetry={recipe.refetch}
      />
    );
  }

  const data = recipe.data;
  const ingredients = data.ingredients ?? [];
  const outputs = (data as { outputs?: RecipeOutputRow[] }).outputs ?? [];
  const multiOutput = outputs.length > 1;

  const totalCost = ingredients.reduce(
    (sum, ing) => sum + ing.quantityPerUnit * (ing.unitCost || 0),
    0,
  );

  const yieldQty =
    data.yieldQuantity && data.yieldQuantity > 0 ? data.yieldQuantity : 1;
  const costPerUnit = totalCost / yieldQty;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={routes.kitchen(shopId)}
        className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to kitchen
      </Link>

      <PageHeader
        title={data.name}
        description={
          multiOutput
            ? `Multi-output · ${outputs.length} sizes · batch yield ${data.yieldQuantity} ${data.yieldUnit}`
            : `Yields ${data.yieldQuantity} ${data.yieldUnit} per batch`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {multiOutput ? (
              <Badge tone="neutral">Multi-output</Badge>
            ) : null}
            <Badge tone={data.isAvailable ? "success" : "danger"}>
              {data.isAvailable ? "Available" : "Blocked"}
            </Badge>
            {data.maxPortionsFromStock != null ? (
              <Badge tone="neutral">
                Max ~{data.maxPortionsFromStock} from stock
              </Badge>
            ) : null}
          </div>
        }
      />

      {data.menuItemId ? (
        <p className="text-xs text-ink-muted">
          Primary finished SKU{" "}
          <span className="font-medium text-ink">{data.menuItemId}</span>
        </p>
      ) : null}

      {outputs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {multiOutput ? "Outputs (sizes)" : "Output"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>SKU</TableHeaderCell>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Std qty / batch
                  </TableHeaderCell>
                  <TableHeaderCell>Unit</TableHeaderCell>
                  <TableHeaderCell>Default</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {outputs.map((out, i) => (
                  <TableRow key={`${out.itemId}-${i}`}>
                    <TableCell className="font-medium">{out.itemId}</TableCell>
                    <TableCell>{out.itemName || out.itemId}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {out.standardQuantity != null
                        ? formatQuantity(out.standardQuantity, out.unit)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {out.unit || "pcs"}
                    </TableCell>
                    <TableCell>
                      {out.isDefault ? (
                        <span className="text-xs font-medium text-primary-700">
                          Default
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-ink-muted">
            Single output — finished SKU{" "}
            <span className="font-medium text-ink">
              {data.menuItemId || "—"}
            </span>
            {data.yieldQuantity != null
              ? ` · ${formatQuantity(data.yieldQuantity, data.yieldUnit)} per batch`
              : null}
          </p>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ingredients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ingredients.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-muted">
              No ingredients on this recipe.
            </p>
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Ingredient</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Qty per batch unit
                  </TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Unit cost
                  </TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Line cost
                  </TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {ingredients.map((ing) => (
                  <TableRow key={ing.rawItemId}>
                    <TableCell className="font-medium">{ing.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(ing.quantityPerUnit, ing.unit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(ing.unitCost || 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(
                        ing.quantityPerUnit * (ing.unitCost || 0),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="p-4">
        <p className="text-sm text-ink-muted">Estimated cost per batch</p>
        <p className="mt-1 font-display text-xl font-semibold text-ink">
          {formatCurrency(totalCost)}
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          {formatCurrency(costPerUnit)} per{" "}
          {(data.yieldUnit || "unit").replace(/s$/, "")}
          {multiOutput
            ? " (batch basis; cost is shared across sizes on finish)"
            : null}
        </p>
      </Card>
    </div>
  );
}
