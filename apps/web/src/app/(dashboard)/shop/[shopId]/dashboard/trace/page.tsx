import type { Metadata } from "next";
import { TracePage } from "@/features/trace/components/TracePage";

export const metadata: Metadata = { title: "Trace" };

export default async function Trace({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <TracePage shopId={shopId} />;
}
