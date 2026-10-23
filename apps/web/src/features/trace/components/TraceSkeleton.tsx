import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function TraceSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
