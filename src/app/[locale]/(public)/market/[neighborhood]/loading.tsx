import { Skeleton } from "@/components/ui/Skeleton";

// Shown instantly while one neighborhood's figures are being fetched.
// Mirrors the real page: back link, title, overview cards, two trend charts.
export default function NeighborhoodLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-9 w-72 max-w-full" />
      <Skeleton className="mt-2 h-4 w-52" />

      <Skeleton className="mt-8 h-6 w-36" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>

      <Skeleton className="mt-6 h-80 w-full rounded-xl" />
      <Skeleton className="mt-6 h-80 w-full rounded-xl" />
    </div>
  );
}
