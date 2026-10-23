import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { MenuAvailability } from "../types";

export function MenuAvailabilityBar({ items }: { items: MenuAvailability[] }) {
  const blocked = items.filter((i) => !i.isAvailable);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Menu availability</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-ink-muted">No menu items configured yet.</p>
        ) : (
          items.map((item) => (
            <Badge key={item.menuItemId} tone={item.isAvailable ? "success" : "danger"}>
              {item.name}
              {item.isAvailable ? ` · ${item.maxPortions} left` : " · 86'd"}
            </Badge>
          ))
        )}
        {blocked.length > 0 ? (
          <p className="mt-2 basis-full text-xs text-ink-faint">{blocked.length} item(s) currently unavailable due to low stock.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
