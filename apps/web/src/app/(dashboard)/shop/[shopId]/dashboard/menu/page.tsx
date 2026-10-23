import { MenuPage } from "@/features/menu/components/MenuPage";
import { CatalogPage } from "@/features/menu/components/CatalogPage";

export default async function Page({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  return (
    <div className="flex flex-col gap-10">
      <CatalogPage shopId={shopId} />
      <MenuPage shopId={shopId} />
    </div>
  );
}
