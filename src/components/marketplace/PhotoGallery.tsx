"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type Photo = { src: string; alt: string };

// Photo gallery for the property page: cover large, a thumbnail strip, and a
// full-screen viewer with next / previous / close. Next sits on the reading-end
// side (right in English, left in Arabic) and its arrow mirrors; keyboard
// arrows and swipes follow the same direction.
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const t = useTranslations("properties.gallery");
  const rtl = useLocale() === "ar";
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const lastFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const count = photos.length;

  const go = useCallback((delta: number) => setCurrent((c) => (c + delta + count) % count), [count]);

  const show = (i: number, from?: HTMLElement | null) => {
    lastFocus.current = from ?? null;
    setCurrent(i);
    setOpen(true);
  };
  const close = useCallback(() => {
    setOpen(false);
    lastFocus.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(rtl ? -1 : 1);
      else if (e.key === "ArrowLeft") go(rtl ? 1 : -1);
      else if (e.key === "Tab") {
        // Keep focus inside the viewer.
        const nodes = document.querySelectorAll<HTMLElement>("[data-gallery-viewer] button");
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, rtl, go, close]);

  if (count === 0) return null;
  const photo = photos[current];

  const arrow = (dir: "next" | "previous") => (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5 rtl:rotate-180">
      {dir === "next" ? <path d="M7.5 4.5 13 10l-5.5 5.5" /> : <path d="M12.5 15.5 7 10l5.5-5.5" />}
    </svg>
  );
  const chip = "inline-flex size-12 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white active:bg-black";

  return (
    <div className="mt-6">
      <div className="relative">
        <button
          type="button"
          onClick={(e) => show(current, e.currentTarget)}
          aria-label={t("open", { n: current + 1 })}
          className="block w-full overflow-hidden rounded-xl ring-1 ring-stone-200 focus-visible:outline-2 focus-visible:outline-teal-800 dark:ring-stone-700"
        >
          {broken[current] ? (
            <span className="grid aspect-[4/3] w-full place-items-center bg-stone-100 text-sm text-stone-500 sm:aspect-auto sm:h-96 dark:bg-stone-800">{t("unavailable")}</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.src}
              alt={photo.alt}
              onError={() => setBroken((b) => ({ ...b, [current]: true }))}
              className="aspect-[4/3] w-full object-cover sm:aspect-auto sm:h-96"
            />
          )}
        </button>
        <span className="pointer-events-none absolute bottom-0 end-0 rounded-ee-xl rounded-ss-xl bg-gradient-to-t from-black/70 to-black/40 px-3 py-1 text-xs font-medium text-white" dir="ltr">
          {current + 1} / {count}
        </span>
      </div>

      {count > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <li key={p.src} className="shrink-0">
              <button
                type="button"
                onClick={() => setCurrent(i)}
                aria-label={t("open", { n: i + 1 })}
                aria-current={i === current}
                className={`block overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-teal-800 ${i === current ? "ring-2 ring-teal-700 dark:ring-teal-400" : "ring-1 ring-stone-200 dark:ring-stone-700"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" className="size-16 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div
          data-gallery-viewer
          role="dialog"
          aria-modal="true"
          aria-label={photo.alt}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={close}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) < 50) return;
            // Swipe toward the reading end = next.
            go((dx < 0) !== rtl ? 1 : -1);
          }}
        >
          <button ref={closeRef} type="button" aria-label={t("close")} title={t("close")} onClick={(e) => { e.stopPropagation(); close(); }} className={`${chip} absolute start-3 top-3`}>
            <span aria-hidden="true">✕</span>
          </button>
          <p className="absolute inset-x-0 top-5 text-center text-sm font-medium text-white" dir="ltr">{current + 1} / {count}</p>

          {count > 1 && (
            <>
              <button type="button" aria-label={t("previous")} title={t("previous")} onClick={(e) => { e.stopPropagation(); go(-1); }} className={`${chip} absolute start-3 top-1/2 -translate-y-1/2`}>
                {arrow("previous")}
              </button>
              <button type="button" aria-label={t("next")} title={t("next")} onClick={(e) => { e.stopPropagation(); go(1); }} className={`${chip} absolute end-3 top-1/2 -translate-y-1/2`}>
                {arrow("next")}
              </button>
            </>
          )}

          {broken[current] ? (
            <p className="rounded-lg bg-stone-800 px-6 py-10 text-white" onClick={(e) => e.stopPropagation()}>{t("unavailable")}</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.src}
              alt={photo.alt}
              onClick={(e) => e.stopPropagation()}
              onError={() => setBroken((b) => ({ ...b, [current]: true }))}
              className="max-h-[80vh] max-w-full object-contain"
            />
          )}
          <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-8 text-center text-sm text-white">{photo.alt}</p>
        </div>
      )}
    </div>
  );
}
