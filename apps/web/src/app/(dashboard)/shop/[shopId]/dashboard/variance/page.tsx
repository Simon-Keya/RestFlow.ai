import type { Metadata } from "next";
import { VariancePage } from "@/features/variance/components/VariancePage";

export const metadata: Metadata = { title: "Variance" };

export default async function Variance({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <VariancePage shopId={shopId} />;
}
