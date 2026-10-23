// apps/web/src/features/kitchen/components/RecipeAvailabilityCard.tsx
import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { routes } from "@/lib/routes";
import type { Recipe } from "../types";

export function RecipeAvailabilityCard({
  shopId,
  recipe,
}: {
  shopId: string;
  recipe: Recipe;
}) {
  const ingredients = recipe.ingredients ?? [];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{recipe.name || "Untitled recipe"}</CardTitle>
          <p className="mt-0.5 text-xs text-ink-muted">
            Yields {recipe.yieldQuantity} {recipe.yieldUnit}
            {recipe.menuItemId ? (
              <span className="text-ink-faint">
                {" "}
                · SKU {recipe.menuItemId}
              </span>
            ) : null}
          </p>
        </div>
        <Badge tone={recipe.isAvailable ? "success" : "danger"}>
          {recipe.isAvailable ? "Available" : "Blocked"}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-muted">
          {recipe.isAvailable
            ? `Enough stock for ${recipe.maxPortionsFromStock} more portions.`
            : "Missing one or more ingredients — check inventory."}
        </p>
        <ul className="mt-3 space-y-1">
          {ingredients.slice(0, 3).map((ing) => (
            <li key={ing.rawItemId} className="text-xs text-ink-faint">
              {ing.quantityPerUnit} {ing.unit} · {ing.name || ing.rawItemId}
            </li>
          ))}
          {ingredients.length > 3 ? (
            <li className="text-xs text-ink-faint">
              +{ingredients.length - 3} more ingredients
            </li>
          ) : null}
          {ingredients.length === 0 ? (
            <li className="text-xs text-ink-faint">No ingredients listed</li>
          ) : null}
        </ul>
      </CardContent>
      <CardFooter>
        <Button asChild variant="secondary" size="sm">
          <Link href={routes.recipe(shopId, recipe.recipeId)}>
            View recipe
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}