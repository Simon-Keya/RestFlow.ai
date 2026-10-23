import type { Metadata } from "next";
import { MenuItemDetailPage } from "@/features/consumption/components/MenuItemDetailPage";

export const metadata: Metadata = { title: "Menu item performance" };

export default async function MenuItem({ params }: { params: Promise<{ shopId: string; menuItemId: string }> }) {
  const { shopId, menuItemId } = await params;
  return <MenuItemDetailPage shopId={shopId} menuItemId={menuItemId} />;
}
