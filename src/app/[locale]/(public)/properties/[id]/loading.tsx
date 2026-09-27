import { Skeleton } from "@/components/ui/Skeleton";

// Shown instantly while one property's details are being fetched.
// Mirrors the real page: back link, title row, photos, then two columns.
export default function PropertyDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-9 w-80 max-w-full" />
      <Skeleton className="mt-2 h-4 w-56" />

      {/* Photo grid placeholder */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
