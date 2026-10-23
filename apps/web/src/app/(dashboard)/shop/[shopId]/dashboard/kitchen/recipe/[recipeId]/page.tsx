import type { Metadata } from "next";
import { RecipeDetailPage } from "@/features/kitchen/components/RecipeDetailPage";

export const metadata: Metadata = { title: "Recipe" };

export default async function Recipe({ params }: { params: Promise<{ shopId: string; recipeId: string }> }) {
  const { shopId, recipeId } = await params;
  return <RecipeDetailPage shopId={shopId} recipeId={recipeId} />;
}
