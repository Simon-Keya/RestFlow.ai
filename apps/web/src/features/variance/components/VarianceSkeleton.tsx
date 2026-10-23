import { Card } from "@/components/ui/Card";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export function VarianceSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
          </Card>
        ))}
      </div>
      <Card>
        <TableSkeleton rows={6} cols={5} />
      </Card>
    </div>
  );
}
