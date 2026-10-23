import Link from "next/link";
import { Boxes, ChefHat, ShoppingCart, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { routes } from "@/lib/routes";

export function QuickLinks({ shopId }: { shopId: string }) {
  const links = [
    { label: "Receive stock", href: routes.inventory(shopId), icon: Boxes },
    { label: "Closing stock", href: routes.closingStock(shopId), icon: ChefHat },
    { label: "New order", href: routes.pos(shopId), icon: ShoppingCart },
    { label: "Log waste", href: routes.waste(shopId), icon: Trash2 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {links.map(({ label, href, icon: Icon }) => (
        <Card key={label} className="transition hover:border-primary-300 hover:shadow-none">
          <Link href={href} className="flex flex-col items-center gap-2 px-4 py-5 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary-700">
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </div>
            <span className="text-xs font-medium text-ink">{label}</span>
          </Link>
        </Card>
      ))}
    </div>
  );
}
