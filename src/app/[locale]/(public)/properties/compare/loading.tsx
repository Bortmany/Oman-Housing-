import { Skeleton } from "@/components/ui/Skeleton";

// Shown instantly while the listing comparison page loads.
// Mirrors the real page: heading, two pickers, then two columns of cards.
export default function PropertiesCompareLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />

      {/* Picker row placeholder */}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-28" />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
