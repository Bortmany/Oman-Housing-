import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10" aria-busy="true">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <Card className="mt-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-full sm:w-56" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    </div>
  );
}
