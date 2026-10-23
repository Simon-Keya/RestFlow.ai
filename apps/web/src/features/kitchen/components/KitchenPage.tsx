"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, ChefHat } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Alert } from "@/components/ui/Alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

import { useKitchenDashboard } from "../hooks/use-kitchen-dashboard";
import { useProductionQueue } from "../hooks/use-production-queue";
import { useClosingStock } from "../hooks/use-closing-stock";
import { kitchenApi } from "../api";
import { startProductionSchema, type StartProductionInput } from "../schema";
import { PrePrepModal } from "./PrePrepModal";

import { KitchenSummaryCards } from "./KitchenSummaryCards";
import { ActiveOrdersBoard } from "./ActiveOrdersBoard";
import { ProductionQueueTable } from "./ProductionQueueTable";
import { ProductionHistoryTable } from "./ProductionHistoryTable";
import { RecipeAvailabilityCard } from "./RecipeAvailabilityCard";
import { RefillPendingList } from "./RefillPendingList";
import { ClosingStockForm } from "./ClosingStockForm";
import { KitchenSkeleton } from "./KitchenSkeleton";
import { FinishProductionModal } from "./FinishProductionModal";
import { RefillDetailDrawer } from "./RefillDetailDrawer";
import { useToast } from "@/providers/ToastProvider";
import { ApiError } from "@/lib/api/errors";
import type { ProductionQueueItem, Recipe } from "../types";

type KitchenTabValue =
  | "orders"
  | "queue"
  | "history"
  | "recipes"
  | "refills"
  | "closing-stock";

const TABS: Array<{ value: KitchenTabValue; label: string }> = [
  { value: "orders", label: "Orders" },
  { value: "queue", label: "Queue" },
  { value: "history", label: "History" },
  { value: "recipes", label: "Recipes" },
  { value: "refills", label: "Refills" },
  { value: "closing-stock", label: "Closing stock" },
];

function StartProductionModal({
  open,
  onOpenChange,
  onStarted,
  recipes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: () => void;
  recipes: Recipe[];
}) {
  const [form, setForm] = useState({ recipe_id: "", batch_size: "" });
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (input: StartProductionInput) =>
      kitchenApi.startProduction(input),
    onSuccess: () => {
      toast({ title: "Production started", variant: "success" });
      onStarted();
      onOpenChange(false);
      setForm({ recipe_id: "", batch_size: "" });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : "Couldn't start this batch.",
      ),
  });

  function handleSubmit() {
    const result = startProductionSchema.safeParse(form);
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ?? "Check the form and try again.",
      );
      return;
    }
    setError(null);
    mutation.mutate(result.data);
  }

  const recipeOptions = recipes.map((r) => ({
    value: r.recipeId,
    label: `${r.name} (${r.menuItemId || r.recipeId})`,
  }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Start a production batch"
      description="Uses the recipe bill of materials. Batch size = planned yield count."
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={mutation.isPending}>
            Start batch
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? <Alert tone="danger" title={error} /> : null}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Recipe
          </label>
          {recipeOptions.length > 0 ? (
            <SearchableSelect
              value={form.recipe_id}
              onValueChange={(value) =>
                setForm({ ...form, recipe_id: value })
              }
              options={recipeOptions}
              placeholder="Select a recipe"
              searchPlaceholder="Search recipe name or code…"
            />
          ) : (
            <Input
              value={form.recipe_id}
              onChange={(e) =>
                setForm({ ...form, recipe_id: e.target.value })
              }
              placeholder="Paste recipe UUID from Recipes list"
            />
          )}
          <p className="mt-1 text-xs text-ink-faint">
            Finished SKU is taken from the recipe (not typed here).
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            Batch size (planned portions / units)
          </label>
          <Input
            type="number"
            min="0.001"
            step="any"
            value={form.batch_size}
            onChange={(e) =>
              setForm({ ...form, batch_size: e.target.value })
            }
          />
        </div>
      </div>
    </Modal>
  );
}

export function KitchenPage({ shopId }: { shopId: string }) {
  const [prePrepOpen, setPrePrepOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [finishTarget, setFinishTarget] =
    useState<ProductionQueueItem | null>(null);
  const [refillRequestId, setRefillRequestId] = useState<string | null>(null);

  const { activeOrders, recipes } = useKitchenDashboard(shopId);
  const { queue } = useProductionQueue(shopId);
  const { form: closingForm, submit: closingSubmit } = useClosingStock(shopId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const history = useQuery({
    queryKey: ["kitchen", "production-history", shopId],
    queryFn: () => kitchenApi.getProductionHistory(shopId),
    refetchInterval: 60_000,
  });

  const refills = useQuery({
    queryKey: ["kitchen", "refills", shopId],
    queryFn: () => kitchenApi.getPendingRefills(shopId),
    refetchInterval: 20_000,
  });

  if (activeOrders.isPending || queue.isPending) return <KitchenSkeleton />;

  if (activeOrders.isError) {
    return (
      <ErrorState
        title="Couldn't load the kitchen board"
        description={activeOrders.error.message}
        onRetry={activeOrders.refetch}
      />
    );
  }

  const orderList = Array.isArray(activeOrders.data) ? activeOrders.data : [];
  const queueList = Array.isArray(queue.data) ? queue.data : [];
  const recipeList = Array.isArray(recipes.data) ? recipes.data : [];
  const refillList = Array.isArray(refills.data) ? refills.data : [];
  const historyList = Array.isArray(history.data) ? history.data : [];
  const closingEntries = Array.isArray(closingForm.data)
    ? closingForm.data
    : [];

  function invalidateKitchen() {
    void queryClient.invalidateQueries({
      queryKey: ["kitchen", "production-queue", shopId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["kitchen", "production-history", shopId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["kitchen", "active-orders", shopId],
    });
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    void queryClient.invalidateQueries({ queryKey: ["variance"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kitchen"
        description="Orders, production queue, history, recipes, refills, and closing stock."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setPrePrepOpen(true)}>
              Pre-prep
            </Button>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Start batch
            </Button>
          </div>
        }
      />

      <KitchenSummaryCards
        orders={orderList}
        queue={queueList}
        pendingRefills={refillList.length}
      />

      <Tabs defaultValue="orders">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="orders">
          <ActiveOrdersBoard shopId={shopId} orders={orderList} />
        </TabsContent>

        <TabsContent value="queue">
          <Card>
            <ProductionQueueTable
              queue={queueList}
              onFinishRequest={(item) => setFinishTarget(item)}
            />
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <ProductionHistoryTable items={historyList} />
          </Card>
        </TabsContent>

        <TabsContent value="recipes">
          {recipeList.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recipeList.map((recipe) => (
                <RecipeAvailabilityCard
                  key={recipe.recipeId}
                  shopId={shopId}
                  recipe={recipe}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ChefHat}
              title="No recipes yet"
              description="Add a recipe to start tracking availability."
            />
          )}
        </TabsContent>

        <TabsContent value="refills">
          <RefillPendingList
            refills={refillList}
            onOpen={(requestId) => setRefillRequestId(requestId)}
          />
        </TabsContent>

        <TabsContent value="closing-stock">
          <Card className="p-4">
            <ClosingStockForm
              entries={closingEntries}
              isSubmitting={closingSubmit.isPending}
              error={closingSubmit.error}
              onSubmit={(submission) => closingSubmit.mutate(submission)}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <PrePrepModal
        open={prePrepOpen}
        onOpenChange={setPrePrepOpen}
        shopId={shopId}
        onCompleted={() => {
          void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
          void queryClient.invalidateQueries({ queryKey: ["inventory"] });
          void queryClient.invalidateQueries({ queryKey: ["waste"] });
          void queryClient.invalidateQueries({ queryKey: ["finished-goods"] });
        }}
      />

      <StartProductionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        recipes={recipeList}
        onStarted={() => {
          void queryClient.invalidateQueries({
            queryKey: ["kitchen", "production-queue", shopId],
          });
          void queryClient.invalidateQueries({
            queryKey: ["kitchen", "production-history", shopId],
          });
        }}
      />

      <FinishProductionModal
        open={!!finishTarget}
        item={finishTarget}
        shopId={shopId}
        onOpenChange={(open) => {
          if (!open) setFinishTarget(null);
        }}
        onFinished={() => {
          setFinishTarget(null);
          toast({ title: "Batch finished", variant: "success" });
          invalidateKitchen();
        }}
      />

      <RefillDetailDrawer
        shopId={shopId}
        requestId={refillRequestId}
        open={!!refillRequestId}
        onClose={() => setRefillRequestId(null)}
      />
    </div>
  );
}