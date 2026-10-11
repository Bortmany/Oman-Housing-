// Where a home is on the map — pure, no I/O. Tested in approxLocation.test.ts.
//
// The listing form has no location field, so most homes have no coordinates of
// their own. Rather than make them invisible to map-area search and alerts, a
// home with no coordinates is placed at the CENTRE OF ITS NEIGHBOURHOOD and
// always marked "approximate". The centre is only ever used for matching and
// for drawing the pin — it is NEVER written into the property's own lat/lng.

import type { Bounds } from "./searchFilters";

type Coord = { lat: number | null; lng: number | null };

export type EffectiveLocation = { lat: number; lng: number; approximate: boolean };

const has = (c: Coord): c is { lat: number; lng: number } =>
  c.lat != null && c.lng != null && Number.isFinite(c.lat) && Number.isFinite(c.lng);

/** The home's own spot, else its neighbourhood's centre (approximate), else null. */
export function effectiveLocation(
  property: Coord,
  neighborhood: Coord | null | undefined,
): EffectiveLocation | null {
  if (has(property)) return { lat: property.lat, lng: property.lng, approximate: false };
  if (neighborhood && has(neighborhood)) {
    return { lat: neighborhood.lat, lng: neighborhood.lng, approximate: true };
  }
  return null;
}

export function inBounds(point: { lat: number; lng: number }, b: Bounds): boolean {
  return point.lat >= b.s && point.lat <= b.n && point.lng >= b.w && point.lng <= b.e;
}

/** Does a home belong to this map area (own spot, else neighbourhood centre)? */
export function matchesArea(
  property: Coord,
  neighborhood: Coord | null | undefined,
  b: Bounds,
): boolean {
  const loc = effectiveLocation(property, neighborhood);
  return loc != null && inBounds(loc, b);
}
