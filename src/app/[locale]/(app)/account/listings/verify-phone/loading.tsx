import { Skeleton } from "@/components/ui/Skeleton";

// Shown while the verification screen loads: title bar, one input-height bar,
// one button-height bar.
export default function VerifyPhoneLoading() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
