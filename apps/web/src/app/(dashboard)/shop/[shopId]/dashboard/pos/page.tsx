import type { Metadata } from "next";
import { PosPage } from "@/features/pos/components/PosPage";

export const metadata: Metadata = { title: "POS" };

export default async function Pos({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <PosPage shopId={shopId} />;
}
