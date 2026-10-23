import type { Metadata } from "next";
import { ClosingStockPage } from "@/features/kitchen/components/ClosingStockPage";

export const metadata: Metadata = { title: "Closing stock" };

export default async function ClosingStock({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <ClosingStockPage shopId={shopId} />;
}
