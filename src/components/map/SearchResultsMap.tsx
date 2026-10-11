"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { PropertyMap, type MapPin } from "@/components/map/PropertyMap";
import { areaSearchQuery, type Bounds } from "@/lib/searchFilters";

// The map on /properties. The visitor drags or zooms; NOTHING reloads. Once
// they have moved it, "Search this area" appears (outside the LTR map, so it
// mirrors in Arabic) and only pressing it changes the URL.
export function SearchResultsMap({
  pins,
  center,
  area,
  query,
}: {
  pins: MapPin[];
  /** Used when there is neither a map area nor any pin to fit. */
  center: { lat: number; lng: number };
  /** The map area currently in the URL, if any. */
  area?: Bounds;
  /** The current clean filters (including the area), as the URL has them. */
  query: Record<string, string>;
}) {
  const t = useTranslations("searchMap");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [moved, setMoved] = useState<Bounds | null>(null);

  function searchHere() {
    if (!moved) return;
    const next = areaSearchQuery(query, moved);
    setMoved(null);
    startTransition(() => {
      // scroll: false keeps the page where it is; the map keeps its view.
      router.push({ pathname: "/properties", query: next }, { scroll: false });
    });
  }

  return (
    <div>
      {moved && (
        <div
          role="status"
          className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
        >
          <Button
            type="button"
            onClick={searchHere}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            {t("searchThisArea")}
          </Button>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            {t("movedHint")}
          </p>
        </div>
      )}
      <div aria-busy={pending} role="group" aria-label={t("mapLabel")}>
        <PropertyMap
          center={center}
          pins={pins}
          zoom={10}
          initialBounds={area}
          fitToPins={!area}
          // A new area only re-fits when it did not come from this map.
          fitKey={area ? "area" : `free:${Object.entries(query).join("|")}`}
          onUserMove={setMoved}
          className="h-72 w-full rounded-xl ring-1 ring-stone-200 sm:h-96 dark:ring-stone-700"
        />
      </div>
    </div>
  );
}
