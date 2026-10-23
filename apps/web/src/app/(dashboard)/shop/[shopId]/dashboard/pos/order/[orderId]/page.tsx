import type { Metadata } from "next";
import { OrderDetailPage } from "@/features/pos/components/OrderDetailPage";

export const metadata: Metadata = { title: "Order detail" };

export default async function Order({ params }: { params: Promise<{ shopId: string; orderId: string }> }) {
  const { shopId, orderId } = await params;
  return <OrderDetailPage shopId={shopId} orderId={orderId} />;
}
