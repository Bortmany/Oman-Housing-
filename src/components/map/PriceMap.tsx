"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { escapeHtml } from "@/lib/escape-html";
import { formatOMRWhole } from "@/lib/money";
import { formatMonth } from "@/lib/i18nData";
import { PRICE_NO_DATA } from "@/lib/chartPalette";
import { NO_DATA_RADIUS, type PriceMapModel } from "@/lib/priceMap";

// Oman as a whole, used when there is nothing to fit to.
const OMAN_CENTER: [number, number] = [57.5, 21.5];

// Price-per-sqm map for /market: one circle per neighbourhood.
// MapLibre is loaded lazily inside the effect, so the page ships no map code
// up front. The map box is forced LTR; the legend sits OUTSIDE it so it
// mirrors in Arabic (house rule 4).
export function PriceMap({ model }: { model: PriceMapModel }) {
  const t = useTranslations("priceMap");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const hasPoints = model.points.length > 0;

  useEffect(() => {
    if (!hasPoints) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;
    // Set once the map has finished its first draw; a late tile error after
    // that must not replace a working map with the failure message.
    let loaded = false;

    (async () => {
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        await import("maplibre-gl/dist/maplibre-gl.css");
        const { buildMapStyle } = await import("./mapStyle");
        if (cancelled || !containerRef.current) return;

        const isMac =
          typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || "");
        map = new maplibregl.Map({
          container: containerRef.current,
          center: OMAN_CENTER,
          zoom: 5,
          style: buildMapStyle(maplibregl, locale),
          // One finger scrolls the page; two fingers (or Ctrl + scroll) move the map.
          cooperativeGestures: true,
          locale: {
            "CooperativeGesturesHandler.MobileHelpText": t("gestureTouch"),
            "CooperativeGesturesHandler.WindowsHelpText": t("gestureScroll"),
            "CooperativeGesturesHandler.MacHelpText": isMac
              ? t("gestureScroll").replace("Ctrl", "⌘")
              : t("gestureScroll"),
          },
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }));

        const bounds = new maplibregl.LngLatBounds();
        for (const p of model.points) bounds.extend([p.lng, p.lat]);
        if (model.points.length === 1) {
          map.setCenter([model.points[0].lng, model.points[0].lat]);
          map.setZoom(10);
        } else {
          map.fitBounds(bounds, { padding: 48, maxZoom: 11, animate: false });
        }

        map.on("error", () => {
          if (!cancelled && !loaded) setStatus("failed");
        });

        map.on("load", () => {
          if (cancelled || !map) return;
          loaded = true;
          setStatus("ready");

          map.addSource("areas", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              // Biggest first, so small circles stay clickable on top.
              features: [...model.points]
                .sort((a, b) => b.radius - a.radius)
                .map((p) => ({
                  type: "Feature" as const,
                  geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
                  properties: {
                    slug: p.slug,
                    radius: p.radius,
                    color: p.color ?? PRICE_NO_DATA,
                    hasData: p.step != null,
                  },
                })),
            },
          });
          map.addLayer({
            id: "areas-dark-ring",
            type: "circle",
            source: "areas",
            paint: {
              "circle-radius": ["+", ["get", "radius"], 2.5],
              "circle-color": "rgba(0,0,0,0)",
              "circle-stroke-color": "#44403c",
              "circle-stroke-width": 1,
              "circle-stroke-opacity": ["case", ["get", "hasData"], 0.6, 0],
            },
          });
          map.addLayer({
            id: "areas",
            type: "circle",
            source: "areas",
            paint: {
              "circle-radius": ["get", "radius"],
              "circle-color": ["get", "color"],
              "circle-opacity": ["case", ["get", "hasData"], 0.9, 0.3],
              "circle-stroke-color": ["case", ["get", "hasData"], "#ffffff", PRICE_NO_DATA],
              "circle-stroke-width": 1.5,
            },
          });

          const bySlug = new Map(model.points.map((p) => [p.slug, p]));
          map.on("mouseenter", "areas", () => {
            if (map) map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "areas", () => {
            if (map) map.getCanvas().style.cursor = "";
          });
          map.on("click", "areas", (e) => {
            const slug = e.features?.[0]?.properties?.slug as string | undefined;
            const p = slug ? bySlug.get(slug) : undefined;
            if (!p || !map) return;
            // Raw HTML: every dynamic string is escaped; the body gets the
            // page's own direction because the map box is forced LTR.
            const dir = locale === "ar" ? "rtl" : "ltr";
            const lines: string[] = [
              `<strong style="font-size:14px">${escapeHtml(p.name)}</strong>`,
            ];
            if (p.price != null) {
              lines.push(
                `<div>${escapeHtml(t("popupPrice", { value: formatOMRWhole(p.price, locale) }))}</div>`,
              );
              if (p.isSample) {
                lines.push(`<div style="font-weight:600">${escapeHtml(t("popupIsSample"))}</div>`);
              }
              if (p.sampleSize != null) {
                lines.push(
                  `<div>${escapeHtml(t("popupSample", { count: String(p.sampleSize) }))}</div>`,
                );
              }
              if (p.periodStart) {
                lines.push(
                  `<div>${escapeHtml(t("popupMonth", { month: formatMonth(locale, new Date(p.periodStart)) }))}</div>`,
                );
              }
            } else {
              lines.push(`<div>${escapeHtml(t("noDataHint"))}</div>`);
            }
            lines.push(
              `<a href="${escapeHtml(`/${locale}/market/${encodeURIComponent(p.slug)}`)}" style="display:inline-flex;min-height:44px;align-items:center;color:#0f766e;font-weight:600;text-decoration:underline">${escapeHtml(t("popupOpen"))}</a>`,
            );
            new maplibregl.Popup({ offset: p.radius + 4, maxWidth: "260px" })
              .setLngLat([p.lng, p.lat])
              .setHTML(`<div dir="${dir}" style="text-align:start;line-height:1.5">${lines.join("")}</div>`)
              .addTo(map);
          });
        });
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [model, locale, t, hasPoints]);

  return (
    <div>
      {hasPoints &&
        (status === "failed" ? (
          <div
            role="status"
            className="flex h-72 w-full items-center justify-center rounded-xl bg-stone-100 px-4 text-center text-sm text-stone-600 ring-1 ring-stone-200 sm:h-[28rem] dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700"
          >
            {t("mapFailed")}
          </div>
        ) : (
          <div className="relative">
            {/* Map box: forced LTR on purpose (house rule 4). Height reserved up front. */}
            <div
              ref={containerRef}
              dir="ltr"
              role="img"
              aria-label={t("mapLabel")}
              className="h-72 w-full rounded-xl ring-1 ring-stone-200 sm:h-[28rem] dark:ring-stone-700"
            />
            {status === "loading" && (
              <div
                role="status"
                aria-busy="true"
                className="pointer-events-none absolute inset-0 flex animate-pulse items-center justify-center rounded-xl bg-stone-200 text-sm text-stone-600 motion-reduce:animate-none dark:bg-stone-800 dark:text-stone-300"
              >
                {t("loading")}
              </div>
            )}
          </div>
        ))}

      {/* Legend: OUTSIDE the LTR map box so it mirrors in Arabic. */}
      <div className="mt-4 space-y-3 text-sm text-stone-700 dark:text-stone-300">
        {model.steps.length > 0 && (
          <div>
            <p className="font-medium text-stone-900 dark:text-stone-100">{t("legendTitle")}</p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {model.steps.map((s) => (
                <li key={s.color} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-4 w-4 shrink-0 rounded-full ring-2 ring-white outline outline-1 outline-stone-600/60"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="whitespace-nowrap">
                    {s.to > s.from
                      ? `${formatOMRWhole(s.from, locale)} – ${formatOMRWhole(s.to, locale)}`
                      : formatOMRWhole(s.from, locale)}
                  </span>
                </li>
              ))}
              {model.hasNoData && (
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block shrink-0 rounded-full border-2"
                    style={{
                      width: NO_DATA_RADIUS * 2 + 2,
                      height: NO_DATA_RADIUS * 2 + 2,
                      borderColor: PRICE_NO_DATA,
                      backgroundColor: `${PRICE_NO_DATA}4d`,
                    }}
                  />
                  <span>{t("noData")}</span>
                </li>
              )}
            </ul>
          </div>
        )}
        <p className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
          {t("sizeKey")} · {t("latestNote")}
        </p>
        {model.weakest && (
          <div className="flex flex-wrap items-center gap-2">
            <span>{t("sourceLabel")}</span>
            <ProvenanceBadge
              provenance={model.weakest.provenance}
              confidence={model.weakest.confidence}
              isSample={model.weakest.isSample}
            />
          </div>
        )}
        {model.weakest?.isSample && (
          <p className="rounded-lg bg-stone-100 px-3 py-2 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
            {t("sampleNote")}
          </p>
        )}
        {model.unplaced > 0 && (
          <p className="text-stone-600 dark:text-stone-400">
            {t("unplaced", { count: String(model.unplaced) })}
          </p>
        )}
      </div>
    </div>
  );
}
