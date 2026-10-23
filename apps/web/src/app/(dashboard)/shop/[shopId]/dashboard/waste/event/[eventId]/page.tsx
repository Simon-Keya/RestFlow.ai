import type { Metadata } from "next";
import { WasteEventDetailPage } from "@/features/waste/components/WasteEventDetailPage";

export const metadata: Metadata = { title: "Waste event" };

export default async function WasteEvent({ params }: { params: Promise<{ shopId: string; eventId: string }> }) {
  const { shopId, eventId } = await params;
  return <WasteEventDetailPage shopId={shopId} eventId={eventId} />;
}
