// Gray placeholder blocks shown while a page's real data is still loading.
// They pulse gently (and stay still for people who prefer reduced motion),
// and use only direction-neutral spacing so they look right in Arabic too.

export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-stone-200 motion-reduce:animate-none ${className}`}
    />
  );
}

// A placeholder shaped like one property card in the search grid:
// photo on top, then a price row, a title line, a details line, and the
// badge/heart row at the bottom — same layout as the real ListingCard.
export function SkeletonPropertyCard() {
  return (
    <div className="flex h-full flex-col rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
      <Skeleton className="h-40 w-full rounded-none rounded-t-xl" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-7 w-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// Placeholder rows shaped like a data table: one wider "name" block at the
// start of each row, then a few shorter blocks. Used by the admin and
// agency loading screens.
export function SkeletonTableRows({
  rows = 6,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="divide-y divide-stone-100">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 py-3">
          <Skeleton className="h-4 w-2/5" />
          {Array.from({ length: Math.max(cols - 1, 0) }, (_, col) => (
            <Skeleton key={col} className="h-4 w-16" />
          ))}
        </div>
      ))}
    </div>
  );
}
