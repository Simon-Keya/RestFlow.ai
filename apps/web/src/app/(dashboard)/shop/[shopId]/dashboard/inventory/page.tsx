import type { Metadata } from "next";
import { InventoryPage } from "@/features/inventory/components/InventoryPage";

export const metadata: Metadata = { title: "Inventory" };

export default async function Inventory({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <InventoryPage shopId={shopId} />;
}
