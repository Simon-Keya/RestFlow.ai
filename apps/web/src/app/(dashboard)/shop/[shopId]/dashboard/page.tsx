import type { Metadata } from "next";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <DashboardPage shopId={shopId} />;
}
