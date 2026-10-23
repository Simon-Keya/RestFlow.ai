import type { Metadata } from "next";
import { ApprovalsPage } from "@/features/approvals/components/ApprovalsPage";

export const metadata: Metadata = { title: "Approvals" };

export default async function Approvals({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <ApprovalsPage shopId={shopId} />;
}
