// apps/web/src/features/recipes/components/CreateRecipePage.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { routes } from "@/lib/routes";
import { useToast } from "@/providers/ToastProvider";
import { useAuthStore } from "@/store/auth";
import { canEditRecipe } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShieldOff } from "lucide-react";
import { useCreateRecipe } from "../hooks/use-create-recipe";
import { CreateRecipeForm } from "./CreateRecipeForm";
import type { CreateRecipeInput } from "../schema";

export function CreateRecipePage({ shopId }: { shopId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const create = useCreateRecipe(shopId);
  const role = useAuthStore((s) => s.user?.role);

  if (!canEditRecipe(role)) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Read-only"
        description="Only administrators and managers can create recipes."
      />
    );
  }


  function handleSubmit(input: CreateRecipeInput) {
    if (create.isPending) return;

    create.mutate(input, {
      onSuccess: (result) => {
        toast({
          title: "Recipe created",
          description: `ID ${result.recipeId}`,
          variant: "success",
        });
        router.push(routes.recipes(shopId));
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={routes.recipes(shopId)}
        className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to recipes
      </Link>

      <PageHeader
        title="Create recipe"
        description="Define the bill of materials for a finished item."
      />

      <Card className="p-5">
        <CreateRecipeForm
          isSubmitting={create.isPending}
          error={create.error}
          onSubmit={handleSubmit}
        />
      </Card>
    </div>
  );
}