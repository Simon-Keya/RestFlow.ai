// apps/web/src/app/(app)/[shopId]/finished-goods/page.tsx
"use client";

import { useParams } from "next/navigation";
import { FinishedGoodsPage } from "@/features/finished-goods/components/FinishedGoodsPage";

export default function Page() {
  const params = useParams();
  const shopId = String(params.shopId ?? "1");

  return <FinishedGoodsPage shopId={shopId} />;
}