// apps/web/src/app/shop/[shopId]/dashboard/recipes/[recipeId]/page.tsx
import { RecipeDetailPage } from "@/features/recipe/components/RecipeDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ shopId: string; recipeId: string }>;
}) {
  const { shopId, recipeId } = await params;
  return <RecipeDetailPage shopId={shopId} recipeId={recipeId} />;
}