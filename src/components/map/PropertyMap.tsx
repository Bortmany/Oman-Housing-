"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { escapeHtml } from "@/lib/escape-html";
import { clampBounds, sameArea, type Bounds } from "@/lib/searchFilters";

export type MapPin = {
  lat: number;
  lng: number;
  label: string;
  /** Optional in-app link (already locale-prefixed) opened from the popup. */
  href?: string;
  /** Optional price, already formatted for the page language. */
  price?: string;
  /** Optional extra line in the popup, e.g. "Approximate location" (already translated). */
  note?: string;
};

type MapLibre = typeof import("maplibre-gl");

type Props = {
  center: { lat: number; lng: number };
  pins: MapPin[];
  zoom?: number;
  className?: string;
  /**
   * Interactive mode (the /properties search). Called with the visible box
   * after the VISITOR moves or zooms the map — never for the map's own
   * first fit. Also turns on two-finger / Ctrl-scroll gestures so one finger
   * still scrolls the page. Leave unset for a plain pin map.
   */
  onUserMove?: (bounds: Bounds) => void;
  /** Open on exactly this area instead of centre + zoom. */
  initialBounds?: Bounds;
  /** Open zoomed to fit every pin (ignored when initialBounds is given). */
  fitToPins?: boolean;
  /**
   * When this changes the map re-fits (pins or initialBounds), unless it is
   * already showing that area. Pins changing alone never moves the map.
   */
  fitKey?: string;
};

// MapLibre, loaded lazily on the client only. The look and tile source come
// from ./mapStyle (Protomaps when configured, raster tiles otherwise).
//
// The map instance is created once. Pins live on top of it and are replaced
// in place whenever the `pins` prop changes, so a parent re-render (e.g. the
// results refreshing after "Search this area") never resets the visitor's view.
export function PropertyMap({
  center,
  pins,
  zoom = 13,
  // The map keeps its light tiles in dark mode (readable, and the tile
  // provider has no dark set) — only its frame changes.
  className = "h-80 w-full rounded-xl ring-1 ring-stone-200 dark:ring-stone-700",
  onUserMove,
  initialBounds,
  fitToPins = false,
  fitKey,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("searchMap");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const libRef = useRef<MapLibre | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Latest values for callbacks that outlive a render.
  const latest = useRef({ pins, onUserMove, initialBounds, fitToPins });
  useEffect(() => {
    latest.current = { pins, onUserMove, initialBounds, fitToPins };
  });
  // What the map opened with: the create effect must not re-run when these change.
  const initial = useRef({ center, zoom });
  const interactive = onUserMove !== undefined;

  // 1. Create the map once (per page language).
  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    let map: import("maplibre-gl").Map | undefined;

    (async () => {
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        await import("maplibre-gl/dist/maplibre-gl.css");
        const { buildMapStyle } = await import("./mapStyle");
        if (cancelled || !containerRef.current) return;
        libRef.current = maplibregl;

        const isMac =
          typeof navigator !== "undefined" &&
          /Mac|iPhone|iPad/i.test(navigator.platform || "");
        const first = latest.current;
        map = new maplibregl.Map({
          container: containerRef.current,
          center: [initial.current.center.lng, initial.current.center.lat],
          zoom: initial.current.zoom,
          style: buildMapStyle(maplibregl, locale),
          ...(interactive
            ? {
                // One finger scrolls the page; two fingers (or Ctrl + scroll) move the map.
                cooperativeGestures: true,
                locale: {
                  "CooperativeGesturesHandler.MobileHelpText": t("gestureTouch"),
                  "CooperativeGesturesHandler.WindowsHelpText": t("gestureScroll"),
                  "CooperativeGesturesHandler.MacHelpText": isMac
                    ? t("gestureScroll").replace("Ctrl", "⌘")
                    : t("gestureScroll"),
                },
              }
            : {}),
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }));

        // Opening view (no animation, so it is not mistaken for a user move).
        if (first.initialBounds) {
          const b = first.initialBounds;
          map.fitBounds(
            [[b.w, b.s], [b.e, b.n]],
            { padding: 0, animate: false },
          );
        } else if (first.fitToPins && first.pins.length > 0) {
          fitPins(maplibregl, map, first.pins);
        }

        map.on("error", () => {
          if (!cancelled && !loaded) setFailed(true);
        });
        map.on("load", () => {
          loaded = true;
        });

        // Only moves that come from the visitor (drag, wheel, pinch, keys,
        // zoom buttons) carry an originalEvent; fitBounds/setCenter do not.
        map.on("moveend", (e) => {
          if (!(e as { originalEvent?: unknown }).originalEvent) return;
          const cb = latest.current.onUserMove;
          if (!cb || !map) return;
          const b = map.getBounds();
          const box = clampBounds({
            n: b.getNorth(),
            s: b.getSouth(),
            e: b.getEast(),
            w: b.getWest(),
          });
          if (box) cb(box);
        });

        mapRef.current = map;
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current = [];
      mapRef.current = null;
      map?.remove();
      setReady(false);
    };
    // The map is made once; later prop changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // 2. Replace the pins in place — the map itself is left alone.
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libRef.current;
    if (!ready || !map || !maplibregl) return;

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = pins.map((pin) => {
      const popup = new maplibregl.Popup({ offset: 16 });
      const dir = locale === "ar" ? "rtl" : "ltr";
      // Raw HTML, not JSX: every piece of text is escaped (stored-XSS guard).
      const title = pin.href
        ? `<a href="${escapeHtml(pin.href)}" style="color:#0f766e;font-weight:600;text-decoration:underline">${escapeHtml(pin.label)}</a>`
        : `<span style="font-weight:600">${escapeHtml(pin.label)}</span>`;
      const price = pin.price
        ? `<div style="margin-top:2px">${escapeHtml(pin.price)}</div>`
        : "";
      const note = pin.note
        ? `<div style="margin-top:2px;font-size:12px;color:#57534e">${escapeHtml(pin.note)}</div>`
        : "";
      // The map box is forced LTR; the popup text follows the page language.
      popup.setHTML(`<div dir="${dir}">${title}${price}${note}</div>`);
      return new maplibregl.Marker({ color: "#0d9488" })
        .setLngLat([pin.lng, pin.lat])
        .setPopup(popup)
        .addTo(map);
    });
  }, [pins, ready, locale]);

  // 3. Re-fit only when asked to (fitKey changed), and never if the map is
  //    already showing the area it would fit to.
  const lastFitKey = useRef(fitKey);
  useEffect(() => {
    if (!ready) return;
    if (lastFitKey.current === fitKey) return;
    lastFitKey.current = fitKey;
    const map = mapRef.current;
    const maplibregl = libRef.current;
    if (!map || !maplibregl) return;
    const { initialBounds: target, fitToPins: fit, pins: current } = latest.current;
    if (target) {
      const view = map.getBounds();
      const showing = clampBounds({
        n: view.getNorth(),
        s: view.getSouth(),
        e: view.getEast(),
        w: view.getWest(),
      });
      if (showing && sameArea(showing, target, 0.002)) return;
      map.fitBounds([[target.w, target.s], [target.e, target.n]], {
        padding: 0,
        animate: false,
      });
    } else if (fit && current.length > 0) {
      fitPins(maplibregl, map, current);
    }
  }, [fitKey, ready]);

  return (
    <div className="relative">
      <div ref={containerRef} dir="ltr" className={className} />
      {failed && interactive && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-stone-100 p-4 text-center text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300"
        >
          {t("mapFailed")}
        </div>
      )}
    </div>
  );
}

function fitPins(
  maplibregl: MapLibre,
  map: import("maplibre-gl").Map,
  pins: MapPin[],
) {
  const box = new maplibregl.LngLatBounds();
  for (const p of pins) box.extend([p.lng, p.lat]);
  map.fitBounds(box, { padding: 48, maxZoom: 14, animate: false });
}
