import type { Metadata } from "next";
import { ConsumptionAlertsPage } from "@/features/consumption/components/ConsumptionAlertsPage";

export const metadata: Metadata = { title: "Consumption alerts" };

export default async function ConsumptionAlerts({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <ConsumptionAlertsPage shopId={shopId} />;
}
