import type { Metadata } from "next";
import { ProductDetailPage } from "@/features/consumption/components/ProductDetailPage";

export const metadata: Metadata = { title: "Product consumption" };

export default async function Product({ params }: { params: Promise<{ shopId: string; productId: string }> }) {
  const { shopId, productId } = await params;
  return <ProductDetailPage shopId={shopId} productId={productId} />;
}
