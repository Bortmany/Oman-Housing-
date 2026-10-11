import type { AdView } from "@/lib/ads/rules";

/**
 * One ad, drawn from its view model. Always carries the visible "Ad · إعلان"
 * label (real text, never colour or an icon alone) in a header row ABOVE the
 * picture, so the label can never be hidden by artwork. It is its own card:
 * it is never placed inside a data card, never uses the provenance colours,
 * and has a clear gap from the figures around it.
 */
export function AdCard({ ad, className = "" }: { ad: AdView; className?: string }) {
  return (
    <aside
      data-ad-slot={ad.slot}
      className={`overflow-hidden rounded-xl bg-stone-50 ring-1 ring-stone-300 dark:bg-stone-950 dark:ring-stone-700 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span
          dir="ltr"
          className="rounded-md bg-stone-800 px-2 py-0.5 text-xs font-semibold text-white rtl:text-sm dark:bg-stone-200 dark:text-stone-900"
        >
          {ad.label}
        </span>
        {ad.by && <span className="min-w-0 truncate text-xs text-stone-600 rtl:text-sm dark:text-stone-300">{ad.by}</span>}
      </div>
      <a
        href={ad.href}
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        aria-label={ad.linkHint}
        className="block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-800"
      >
        <div className="w-full bg-stone-200 dark:bg-stone-800" style={{ aspectRatio: ad.ratio }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin /api/images, fixed box so nothing jumps */}
          <img src={ad.imageSrc} alt={ad.alt} className="size-full object-cover" loading="lazy" decoding="async" />
        </div>
      </a>
    </aside>
  );
}
