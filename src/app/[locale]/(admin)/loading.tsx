import { Skeleton, SkeletonTableRows } from "@/components/ui/Skeleton";

// Shown instantly while any admin page fetches its data.
// A generic shape: heading, action button, filter row, then a table.
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-24 rounded-full" />
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
        <SkeletonTableRows rows={8} cols={4} />
      </div>
    </div>
  );
}
