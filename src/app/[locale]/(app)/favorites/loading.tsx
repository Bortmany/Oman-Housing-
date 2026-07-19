import { Skeleton, SkeletonPropertyCard } from "@/components/ui/Skeleton";

// Shown instantly while your saved listings are being fetched.
// Mirrors the real page: heading, then the favorites grid.
export default function FavoritesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-9 w-56" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonPropertyCard key={i} />
        ))}
      </div>
    </div>
  );
}
