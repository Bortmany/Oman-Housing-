import { Skeleton } from "@/components/ui/Skeleton";

// Shown while one listing loads: title bars, status pill, action card, form blocks.
export default function OwnerListingLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-square w-full" />)}
          </div>
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
