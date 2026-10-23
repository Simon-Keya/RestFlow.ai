import { Card } from "@/components/ui/Card";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export function InventorySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-16" />
          </Card>
        ))}
      </div>
      <Card>
        <TableSkeleton rows={8} cols={6} />
      </Card>
    </div>
  );
}
