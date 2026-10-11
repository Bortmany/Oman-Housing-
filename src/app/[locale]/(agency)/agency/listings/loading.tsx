import { Skeleton, SkeletonTableRows } from "@/components/ui/Skeleton";

// Shown while My listings loads: below 640 px three card-shaped blocks (title
// bar, price bar, pill-shaped bar); from 640 px the table skeleton.
export default function AgencyListingsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-11 w-full sm:w-36" />
      </div>
      <Skeleton className="mt-3 h-4 w-56" />
      <div className="mt-6 space-y-3 sm:hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-6 hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:block dark:bg-stone-900 dark:ring-stone-800">
        <SkeletonTableRows rows={6} cols={4} />
      </div>
    </div>
  );
}
