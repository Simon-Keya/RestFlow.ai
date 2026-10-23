import type { Metadata } from "next";
import { ConsumptionPage } from "@/features/consumption/components/ConsumptionPage";

export const metadata: Metadata = { title: "Consumption" };

export default async function Consumption({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <ConsumptionPage shopId={shopId} />;
}
