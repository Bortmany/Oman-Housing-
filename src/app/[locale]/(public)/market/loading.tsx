import { Skeleton } from "@/components/ui/Skeleton";

// Shown instantly while the market dashboard fetches its figures.
// Mirrors the real page: heading, type tabs, trend chart, neighborhood cards.
export default function MarketLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />

      {/* Apartment / villa tabs placeholder */}
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      {/* Trend chart placeholder */}
      <Skeleton className="mt-8 h-80 w-full rounded-xl" />

      <Skeleton className="mt-10 h-6 w-44" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-52 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
