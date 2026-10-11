import { Skeleton, SkeletonPropertyCard } from "@/components/ui/Skeleton";

// Shown instantly while the property search page fetches its listings.
// Mirrors the real page: heading, filter bar, then a grid of card shapes.
export default function PropertiesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />

      {/* Filter bar placeholder */}
      <div className="mt-6 flex flex-wrap gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-36" />
        ))}
      </div>

      <Skeleton className="mt-6 h-4 w-32" />
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonPropertyCard key={i} />
        ))}
      </div>
    </div>
  );
}
