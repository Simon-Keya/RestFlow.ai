import type { Metadata } from "next";
import { CreateRecipePage } from "@/features/recipe/components/CreateRecipePage";

export const metadata: Metadata = { title: "Create recipe" };

export default async function NewRecipe({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  return <CreateRecipePage shopId={shopId} />;
}