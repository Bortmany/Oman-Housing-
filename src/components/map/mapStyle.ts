// The ONE place the map's look and tile source are decided.
//
// - NEXT_PUBLIC_MAP_PMTILES_URL set  -> Protomaps vector tiles read straight
//   from one .pmtiles file (Cloudflare R2), labels in the page language,
//   fonts/sprites/text-shaping served from this site's own /public/map.
// - unset                            -> today's raster tiles from
//   NEXT_PUBLIC_MAP_TILE_URL (default OpenStreetMap), unchanged.
//
// Import this file ONLY from inside a lazy `await import(...)` next to
// MapLibre, so pages that show no map ship none of it.

import type { StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";

type MapLibre = typeof import("maplibre-gl").default;

export const PMTILES_URL = process.env.NEXT_PUBLIC_MAP_PMTILES_URL || "";

const RASTER_TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const RASTER_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "© OpenStreetMap contributors";

// Proper names, so the same text on EN and AR pages.
const PROTOMAPS_ATTRIBUTION =
  '<a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a> © <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

let prepared = false;

/** Register the pmtiles protocol and the Arabic text-shaping plugin, once. */
function prepare(maplibregl: MapLibre) {
  if (prepared) return;
  prepared = true;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  // Arabic letters need joining and right-to-left shaping, which MapLibre does
  // with a small plugin. Self-hosted, and only fetched once a label needs it.
  maplibregl
    .setRTLTextPlugin(`${window.location.origin}/map/mapbox-gl-rtl-text.js`, true)
    .catch(() => {
      /* already set elsewhere on the page, or blocked: labels still draw */
    });
}

/** True when the map is drawn from the Protomaps file. */
export function usesPmtiles(): boolean {
  return PMTILES_URL !== "";
}

/**
 * The MapLibre style for the page language. Call after MapLibre has loaded
 * (browser only).
 */
export function buildMapStyle(
  maplibregl: MapLibre,
  locale: string,
): StyleSpecification {
  if (!usesPmtiles()) {
    return {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: [RASTER_TILE_URL],
          tileSize: 256,
          attribution: RASTER_ATTRIBUTION,
        },
      },
      layers: [{ id: "basemap", type: "raster", source: "basemap" }],
    };
  }

  prepare(maplibregl);
  const origin = window.location.origin;
  return {
    version: 8,
    glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`,
    sprite: `${origin}/map/sprites/light`,
    sources: {
      basemap: {
        type: "vector",
        url: `pmtiles://${PMTILES_URL}`,
        attribution: PROTOMAPS_ATTRIBUTION,
      },
    },
    // Light flavour only: tiles stay light in dark mode.
    layers: layers("basemap", namedFlavor("light"), {
      lang: locale === "ar" ? "ar" : "en",
    }) as StyleSpecification["layers"],
  };
}
