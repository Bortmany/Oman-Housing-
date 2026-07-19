import { Skeleton, SkeletonTableRows } from "@/components/ui/Skeleton";

// Shown instantly while any agency-portal page fetches its data.
// A generic shape: heading, action button, then a table.
export default function AgencyLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
        <SkeletonTableRows rows={6} cols={4} />
      </div>
    </div>
  );
}
