import type { Metadata } from "next";
import { KitchenPage } from "@/features/kitchen/components/KitchenPage";

export const metadata: Metadata = { title: "Kitchen" };

export default async function Kitchen({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <KitchenPage shopId={shopId} />;
}
