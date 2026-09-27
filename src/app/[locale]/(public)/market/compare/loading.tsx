import { Skeleton } from "@/components/ui/Skeleton";

// Shown instantly while the neighborhood comparison page loads.
// Mirrors the real page: heading, three pickers, two cards, one chart.
export default function MarketCompareLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />

      {/* Picker row placeholder */}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-28" />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>

      <Skeleton className="mt-6 h-80 w-full rounded-xl" />
    </div>
  );
}
