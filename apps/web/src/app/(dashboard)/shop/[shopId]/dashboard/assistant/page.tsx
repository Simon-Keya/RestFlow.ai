import type { Metadata } from "next";
import { OperationsAssistantPage } from "@/features/assistant/components/OperationsAssistantPage";

export const metadata: Metadata = { title: "AI Operations Assistant" };

export default async function Assistant({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <OperationsAssistantPage shopId={shopId} />;
}
