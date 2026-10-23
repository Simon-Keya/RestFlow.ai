import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";

export function ApprovalsSkeleton() {
  return (
    <Card>
      <TableSkeleton rows={8} cols={5} />
    </Card>
  );
}
