import type { Metadata } from "next";
import { BatchVariancePage } from "@/features/variance/components/BatchVariancePage";

export const metadata: Metadata = { title: "Variance batch" };

export default async function VarianceBatch({ params }: { params: Promise<{ shopId: string; batchId: string }> }) {
  const { shopId, batchId } = await params;
  return <BatchVariancePage shopId={shopId} batchId={batchId} />;
}
