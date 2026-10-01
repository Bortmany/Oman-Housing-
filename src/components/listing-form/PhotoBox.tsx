"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label } from "@/components/ui/Field";
import { MAX_PHOTOS, PHOTO_MAX_MB } from "@/lib/listings/rules";

/** One photo in the box: already saved on the draft, or chosen and waiting. */
export type PhotoItem = {
  key: string;
  /** Set once the photo is saved on the server. */
  id?: string;
  path?: string;
  /** Browser-side preview (blob address) and the file itself, until uploaded. */
  preview?: string;
  file?: File;
  altEn: string;
  altAr: string;
  /** What the server last had, to know if the description changed. */
  savedAltEn?: string;
  savedAltAr?: string;
  state: "saved" | "waiting" | "uploading" | "failed";
  error?: string;
};

type Props = {
  photos: PhotoItem[];
  busy: boolean;
  /** Messages under the grid: files refused before upload (size, type, count). */
  issues: string[];
  /** Rose box + message when an owner has no photo at submit. */
  requiredError: boolean;
  uploadLine: string | null;
  /** Agencies: photos are optional, so the box title says so. */
  optional?: boolean;
  onAddFiles: (files: File[]) => void;
  onMove: (key: string, move: "earlier" | "later" | "cover") => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  onAlt: (key: string, lang: "En" | "Ar", value: string) => void;
};

function Icon({ d, className = "size-5" }: { d: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

const PHOTO_PLUS = "M4 8a2 2 0 0 1 2-2h1.5l1-1.5h5L15.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm8 1.5v6m-3-3h6";
const DOTS = "M5 12h.01M12 12h.01M19 12h.01";

export function PhotoBox({
  photos, busy, issues, requiredError, uploadLine, optional = false,
  onAddFiles, onMove, onRemove, onRetry, onAlt,
}: Props) {
  const t = useTranslations("myListing.form");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [describeKey, setDescribeKey] = useState<string | null>(null);

  // Close the "…" menu on any outside click or Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const choose = () => inputRef.current?.click();
  const atMax = photos.length >= MAX_PHOTOS;
  const failed = photos.filter((p) => p.state === "failed" && p.error);

  return (
    <Card id="field-photos" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{optional ? t("photosOptional") : t("photosTitle")}</h2>
        <span className="text-xs text-stone-500 dark:text-stone-400" aria-live="polite">
          {t("photosCount", { count: photos.length })}
        </span>
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {t("photosHint", { max: MAX_PHOTOS, size: PHOTO_MAX_MB })}
      </p>
      <p className="text-xs text-stone-500 dark:text-stone-400">{t("photosRights")}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          onAddFiles(Array.from(e.target.files ?? []));
          e.target.value = ""; // so choosing the same file again still fires
        }}
      />

      {photos.length === 0 && (
        <div
          role="button"
          tabIndex={0}
          onClick={choose}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), choose())}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onAddFiles(Array.from(e.dataTransfer.files)); }}
          className={`flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 sm:h-52 ${
            requiredError
              ? "border-rose-600 bg-rose-50 dark:border-rose-500 dark:bg-rose-950"
              : dragging
                ? "border-teal-700 bg-teal-50 dark:border-teal-400 dark:bg-teal-950"
                : "border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
          }`}
        >
          <Icon d={PHOTO_PLUS} className="size-8 text-stone-400" />
          <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
            {dragging ? t("photosDrop") : t("addPhotosTitle")}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {t("addPhotosLimits", { max: MAX_PHOTOS, size: PHOTO_MAX_MB })}
          </p>
          <Button type="button" variant="secondary" disabled={busy} onClick={(e) => { e.stopPropagation(); choose(); }}>
            {t("photosAdd")}
          </Button>
        </div>
      )}

      {requiredError && <FieldError>{t("ownerPhotoRequired")}</FieldError>}
      {uploadLine && (
        <p role="status" className="text-sm font-medium text-teal-800 dark:text-teal-300">{uploadLine}</p>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => {
            const src = p.preview ?? (p.path ? `/api/images/${p.path}` : "");
            const locked = busy || p.state === "uploading";
            const isCover = i === 0;
            return (
              <li key={p.key} className="min-w-0">
                <div className={`relative overflow-hidden rounded-lg ring-1 ${p.state === "failed" ? "ring-2 ring-rose-600" : "ring-stone-200 dark:ring-stone-700"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className={`aspect-square w-full object-cover ${p.state === "failed" ? "opacity-50" : ""}`}
                  />
                  {isCover && (
                    <span className="absolute start-1 top-1 rounded-full bg-teal-800 px-2 py-0.5 text-xs font-semibold text-white">
                      {t("photoCover")}
                    </span>
                  )}
                  {p.state !== "saved" && p.state !== "failed" && (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-xs font-medium text-white">
                      {p.state === "uploading" ? t("photoUploadingOne") : t("photoWaiting")}
                    </span>
                  )}
                  {p.state === "uploading" && (
                    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 animate-pulse bg-teal-500 motion-reduce:animate-none" />
                  )}
                </div>

                <div className="relative mt-1 flex items-center justify-between gap-1">
                  {p.state === "failed" ? (
                    <Button type="button" variant="secondary" className="!min-h-11 flex-1 !px-2 text-xs" disabled={busy} onClick={() => onRetry(p.key)}>
                      {t("photoRetry")}
                    </Button>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs text-stone-500 dark:text-stone-400" dir="auto">
                      {p.file?.name ?? ""}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={t("photoMenu")}
                    aria-haspopup="menu"
                    aria-expanded={menu === p.key}
                    disabled={locked}
                    onClick={(e) => { e.stopPropagation(); setMenu(menu === p.key ? null : p.key); setConfirmKey(null); }}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-stone-600 ring-1 ring-stone-300 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-teal-800 active:bg-stone-200 disabled:opacity-50 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-800"
                  >
                    <Icon d={DOTS} />
                  </button>
                  {menu === p.key && (
                    <ul
                      role="menu"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute end-0 top-12 z-20 w-48 rounded-lg bg-white p-1 text-sm shadow-lg ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700"
                    >
                      {!isCover && (
                        <li><MenuItem onClick={() => { setMenu(null); onMove(p.key, "cover"); }}>{t("photoMakeCover")}</MenuItem></li>
                      )}
                      {i > 0 && (
                        <li><MenuItem onClick={() => { setMenu(null); onMove(p.key, "earlier"); }}>{t("photoEarlier")}</MenuItem></li>
                      )}
                      {i < photos.length - 1 && (
                        <li><MenuItem onClick={() => { setMenu(null); onMove(p.key, "later"); }}>{t("photoLater")}</MenuItem></li>
                      )}
                      <li><MenuItem onClick={() => { setMenu(null); setDescribeKey(describeKey === p.key ? null : p.key); }}>{t("photoDescribe")}</MenuItem></li>
                      <li className="mt-1 border-t border-stone-200 pt-1 dark:border-stone-700">
                        <MenuItem
                          danger
                          onClick={() => {
                            setMenu(null);
                            // A photo that isn't saved yet just goes; a saved one asks first.
                            if (p.id) setConfirmKey(p.key);
                            else onRemove(p.key);
                          }}
                        >
                          {t("photoRemove")}
                        </MenuItem>
                      </li>
                    </ul>
                  )}
                </div>

                {confirmKey === p.key && (
                  <div role="alertdialog" className="mt-1 space-y-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-900 ring-1 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">
                    <p>{t("photoRemoveConfirm")}</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="danger" className="!min-h-11 flex-1 !px-2 text-xs" onClick={() => { setConfirmKey(null); onRemove(p.key); }}>
                        {t("photoRemove")}
                      </Button>
                      <Button type="button" variant="secondary" className="!min-h-11 flex-1 !px-2 text-xs" autoFocus onClick={() => setConfirmKey(null)}>
                        {t("photoKeep")}
                      </Button>
                    </div>
                  </div>
                )}

                {describeKey === p.key && (
                  <div className="mt-1 space-y-2">
                    <div>
                      <Label htmlFor={`alt-en-${p.key}`}>{t("photoAltEn")}</Label>
                      <Input id={`alt-en-${p.key}`} dir="ltr" maxLength={200} value={p.altEn} disabled={locked} onChange={(e) => onAlt(p.key, "En", e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor={`alt-ar-${p.key}`}>{t("photoAltAr")}</Label>
                      <Input id={`alt-ar-${p.key}`} dir="rtl" maxLength={200} value={p.altAr} disabled={locked} onChange={(e) => onAlt(p.key, "Ar", e.target.value)} />
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{t("photoAltHint")}</p>
                  </div>
                )}

                {p.state === "failed" && p.error && <FieldError>{p.error}</FieldError>}
              </li>
            );
          })}

          {!atMax && (
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={choose}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-stone-300 text-xs font-medium text-stone-600 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-teal-800 active:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                <Icon d={PHOTO_PLUS} className="size-6" />
                {t("photosAddMore")}
              </button>
            </li>
          )}
        </ul>
      )}

      {atMax && <p className="text-xs text-stone-500 dark:text-stone-400">{t("photosMax", { max: MAX_PHOTOS })}</p>}

      {(issues.length > 0 || failed.length > 0) && (
        <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">
          <p className="font-medium">{t("photosNeedAttention")}</p>
          <ul className="mt-1 list-disc ps-5 text-xs">
            {issues.map((m, i) => <li key={`i${i}`}>{m}</li>)}
            {failed.map((p) => <li key={p.key}>{p.error}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center rounded-md px-3 text-start hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-teal-800 active:bg-stone-200 dark:hover:bg-stone-800 ${
        danger ? "text-rose-700 dark:text-rose-400" : "text-stone-800 dark:text-stone-200"
      }`}
    >
      {children}
    </button>
  );
}
