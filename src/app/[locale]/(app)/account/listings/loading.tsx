import { Skeleton, SkeletonPropertyCard } from "@/components/ui/Skeleton";

// Shown while My properties loads: title, a cap-line bar, then card shapes
// (one column on a phone, two on a laptop).
export default function OwnerListingsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <Skeleton className="mt-5 h-3 w-48" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 md:gap-6">
        <SkeletonPropertyCard />
        <SkeletonPropertyCard />
      </div>
    </div>
  );
}
