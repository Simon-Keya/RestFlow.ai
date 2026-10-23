import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-24" />
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-48 w-full" />
      </Card>
    </div>
  );
}
