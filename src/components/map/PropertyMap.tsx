"use client";

import { useEffect, useRef } from "react";
import { escapeHtml } from "@/lib/escape-html";

export type MapPin = {
  lat: number;
  lng: number;
  label: string;
  /** Optional in-app link (already locale-prefixed) opened from the popup. */
  href?: string;
};

// MapLibre + raster tiles (no API key). Loaded lazily on the client only.
// Tile URL comes from NEXT_PUBLIC_MAP_TILE_URL so swapping providers is config.
export function PropertyMap({
  center,
  pins,
  zoom = 13,
  // The map keeps its light tiles in dark mode (readable, and the tile
  // provider has no dark set) — only its frame changes.
  className = "h-80 w-full rounded-xl ring-1 ring-stone-200 dark:ring-stone-700",
}: {
  center: { lat: number; lng: number };
  pins: MapPin[];
  zoom?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (cancelled || !containerRef.current) return;

      const tiles =
        process.env.NEXT_PUBLIC_MAP_TILE_URL ??
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

      map = new maplibregl.Map({
        container: containerRef.current,
        center: [center.lng, center.lat],
        zoom,
        style: {
          version: 8,
          sources: {
            raster: {
              type: "raster",
              tiles: [tiles],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "raster", type: "raster", source: "raster" }],
        },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }));

      for (const pin of pins) {
        // A pin with a link gets a clickable popup; the label is escaped
        // because this is raw HTML, not JSX (stored-XSS guard).
        const popup = new maplibregl.Popup({ offset: 16 });
        if (pin.href) {
          popup.setHTML(
            `<a href="${escapeHtml(pin.href)}" style="color:#0f766e;font-weight:600;text-decoration:underline">${escapeHtml(
              pin.label,
            )}</a>`,
          );
        } else {
          popup.setText(pin.label);
        }
        new maplibregl.Marker({ color: "#0d9488" })
          .setLngLat([pin.lng, pin.lat])
          .setPopup(popup)
          .addTo(map);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [center.lat, center.lng, zoom, pins]);

  return <div ref={containerRef} dir="ltr" className={className} />;
}
