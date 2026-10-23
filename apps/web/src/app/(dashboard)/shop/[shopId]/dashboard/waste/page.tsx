import type { Metadata } from "next";
import { WastePage } from "@/features/waste/components/WastePage";

export const metadata: Metadata = { title: "Waste" };

export default async function Waste({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <WastePage shopId={shopId} />;
}
