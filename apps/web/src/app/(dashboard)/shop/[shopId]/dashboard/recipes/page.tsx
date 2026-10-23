import type { Metadata } from "next";
import { RecipesPage } from "@/features/recipe/components/RecipesPage";

export const metadata: Metadata = { title: "Recipes" };

export default async function Recipes({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  return <RecipesPage shopId={shopId} />;
}