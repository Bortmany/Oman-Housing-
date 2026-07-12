"use client";

import { useEffect, useRef } from "react";

export type MapPin = {
  lat: number;
  lng: number;
  label: string;
};

// MapLibre + raster tiles (no API key). Loaded lazily on the client only.
// Tile URL comes from NEXT_PUBLIC_MAP_TILE_URL so swapping providers is config.
export function PropertyMap({
  center,
  pins,
  zoom = 13,
  className = "h-80 w-full rounded-xl ring-1 ring-stone-200",
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
        new maplibregl.Marker({ color: "#0d9488" })
          .setLngLat([pin.lng, pin.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(pin.label))
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
