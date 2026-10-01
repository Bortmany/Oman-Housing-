"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { localName } from "@/lib/i18nData";
import { formatOMRWhole } from "@/lib/money";
import {
  LISTING_FIELDS,
  MAX_DESCRIPTION,
  MAX_PHOTOS,
  OWNERSHIP,
  PHOTO_MAX_MB,
  PROPERTY_TYPES,
  toLatinNumber,
  validateListingValues,
  type FieldError as FieldErr,
  type FieldErrors,
  type ListingField,
  type ListingValues,
} from "@/lib/listings/rules";
import { PhotoBox, type PhotoItem } from "./PhotoBox";
import type {
  ActionError,
  ListingFormActions,
  NeighborhoodOption,
  SavedPhoto,
} from "./types";

// The ONE listing form, used by private owners (now) and agencies (Build B).
// It keeps everything typed in the browser (both English and Arabic boxes),
// names every failing box under that box, and sends photos one per request
// after the text has been saved as a draft. It never decides status, owner,
// agency or provenance — the server does (src/lib/listings/core.ts).

const MAX_BYTES = PHOTO_MAX_MB * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DRAFT_PREFIX = "opip:listing-draft:";

const DEFAULTS: ListingValues = {
  type: "APARTMENT",
  ownership: "UNKNOWN",
  listingType: "SALE",
  rentPeriod: "MONTHLY",
};

type Props = {
  audience: "owner" | "agency";
  mode: "create" | "edit";
  neighborhoods: NeighborhoodOption[];
  actions: ListingFormActions;
  /** Where to go after "Submit for review" succeeds (e.g. /account/listings?submitted=1). */
  successHref: string;
  /** Base path of the edit pages, to move from /new to /<base>/<id> after a draft save. */
  editHrefBase: string;
  /** Browser-draft key, e.g. "owner:new" or "owner:<listingId>". */
  draftKey: string;
  listingId?: string;
  status?: string;
  initialValues?: ListingValues;
  initialPhotos?: SavedPhoto[];
  /** The owner's verified number, shown in the second tick-box. Owners only. */
  ownerPhone?: string;
};

type Stage = null | "saving" | "uploading" | "sending";

let keyCounter = 0;
const newKey = () => `p${Date.now()}-${keyCounter++}`;

export function ListingForm({
  audience, mode, neighborhoods, actions, successHref, editHrefBase, draftKey,
  listingId: initialId, status = "DRAFT", initialValues, initialPhotos = [], ownerPhone,
}: Props) {
  const t = useTranslations("myListing");
  const tf = useTranslations("myListing.form");
  const ta = useTranslations("admin");
  const te = useTranslations("enums");
  const tp = useTranslations("properties");
  const to = useTranslations("owner.form");
  const locale = useLocale();
  const router = useRouter();

  const isOwner = audience === "owner";
  const isDraft = status === "DRAFT";
  const isLive = status === "ACTIVE";

  const startValues: ListingValues = { ...DEFAULTS, ...initialValues };
  const [values, setValues] = useState<ListingValues>(startValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [listingId, setListingId] = useState<string | null>(initialId ?? null);
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    initialPhotos.map((p) => ({
      key: p.id, id: p.id, path: p.path, altEn: p.altEn ?? "", altAr: p.altAr ?? "",
      savedAltEn: p.altEn ?? "", savedAltAr: p.altAr ?? "", state: "saved" as const,
    })),
  );
  const [issues, setIssues] = useState<string[]>([]);
  const [photoRequired, setPhotoRequired] = useState(false);
  const [tickOwner, setTickOwner] = useState(false);
  const [tickPhone, setTickPhone] = useState(false);
  const [tickErr, setTickErr] = useState(false);
  const [stage, setStage] = useState<Stage>(null);
  const [uploadLine, setUploadLine] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [foundDraft, setFoundDraft] = useState<ListingValues | null>(null);
  const [restored, setRestored] = useState(false);
  const orderDirty = useRef(false);
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  const busy = stage !== null;

  // ----- the browser's own draft (this device only, never the server) -----
  const storageKey = DRAFT_PREFIX + draftKey;
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { values?: ListingValues };
      const saved = parsed.values;
      if (!saved) return;
      const differs = LISTING_FIELDS.some((f) => (saved[f] ?? "") !== (startValues[f] ?? ""));
      // Reading this device's saved draft is syncing with an outside store.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (differs) setFoundDraft(saved);
    } catch {
      /* a broken saved draft is simply ignored */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!touched) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ v: 1, values, savedAt: Date.now() }));
      } catch {
        /* storage full or blocked — nothing to do */
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [values, touched, storageKey]);

  const clearDraft = useCallback(() => {
    try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  // Free the preview addresses when the form goes away.
  useEffect(() => () => {
    photosRef.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
  }, []);

  const set = (name: ListingField, value: string) => {
    setTouched(true);
    setValues((v) => ({ ...v, [name]: value }));
  };
  const v = (name: ListingField) => values[name] ?? "";

  // ----- messages -----
  const errText = (e: FieldErr | undefined) => {
    if (!e) return null;
    return t(`errors.${e.key}`, { max: e.max ?? 0 });
  };
  const actionErrorText = (error: ActionError, count?: number): string => {
    switch (error) {
      case "rateLimited": return t("errors.rateLimited");
      case "wrongState": return t("errors.wrongState");
      case "notFound": return t("errors.notFound");
      case "draftLimit": return t("errors.draftLimit", { count: count ?? 0 });
      case "capReached": return t("errors.capReached");
      case "phoneNotVerified": return t("errors.phoneNotVerified");
      case "confirmRequired": return t("errors.confirmRequired");
      case "lastPhoto": return t("errors.lastPhoto");
      case "photoRequired": return tf("ownerPhotoRequired");
      default: return t("errors.saveFailed");
    }
  };
  const photoErrorText = (error: ActionError, name: string): string => {
    switch (error) {
      case "photoSize": return tf("photoErrorSize", { name, size: PHOTO_MAX_MB });
      case "photoType": return tf("photoErrorType", { name });
      case "photoLimit": return tf("photoErrorLimit", { max: MAX_PHOTOS });
      case "rateLimited": return tf("photoRateLimited");
      default: return tf("photoErrorFailed", { name });
    }
  };

  // ----- photos -----
  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    setTouched(true);
    const refused: string[] = [];
    const room = MAX_PHOTOS - photos.length;
    const accepted: PhotoItem[] = [];
    for (const file of files) {
      if (!OK_TYPES.includes(file.type)) {
        refused.push(tf("photoErrorType", { name: file.name }));
      } else if (file.size > MAX_BYTES) {
        refused.push(tf("photoErrorSize", { name: file.name, size: PHOTO_MAX_MB }));
      } else if (accepted.length >= room) {
        if (!refused.includes(tf("photoErrorLimit", { max: MAX_PHOTOS }))) {
          refused.push(tf("photoErrorLimit", { max: MAX_PHOTOS }));
        }
      } else {
        accepted.push({
          key: newKey(), file, preview: URL.createObjectURL(file),
          altEn: "", altAr: "", state: "waiting",
        });
      }
    }
    setIssues(refused);
    if (accepted.length > 0) {
      setPhotoRequired(false);
      setPhotos((p) => [...p, ...accepted]);
    }
  };

  const moveLocal = (list: PhotoItem[], key: string, move: "earlier" | "later" | "cover"): PhotoItem[] => {
    const i = list.findIndex((p) => p.key === key);
    if (i < 0) return list;
    const next = [...list];
    if (move === "cover") {
      const [item] = next.splice(i, 1);
      next.unshift(item);
    } else {
      const j = move === "earlier" ? i - 1 : i + 1;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const onMove = async (key: string, move: "earlier" | "later" | "cover") => {
    const before = photos;
    const after = moveLocal(before, key, move);
    if (after === before) return;
    setPhotos(after);
    // All photos already saved: tell the server now (it never needs review).
    if (listingId && after.every((p) => p.id)) {
      const res = await actions.setPhotoOrder(listingId, after.map((p) => p.id as string));
      if (!res.ok) {
        setPhotos(before);
        setFormError(actionErrorText(res.error));
      }
    } else {
      orderDirty.current = true; // applied after the uploads, in one go
    }
  };

  const onRemove = async (key: string) => {
    const item = photos.find((p) => p.key === key);
    if (!item) return;
    if (item.id && listingId) {
      const res = await actions.removePhoto(listingId, item.id);
      if (!res.ok) {
        setFormError(actionErrorText(res.error));
        return;
      }
    }
    if (item.preview) URL.revokeObjectURL(item.preview);
    setPhotos((p) => p.filter((x) => x.key !== key));
    setIssues([]);
  };

  const onAlt = (key: string, lang: "En" | "Ar", value: string) => {
    setTouched(true);
    setPhotos((p) => p.map((x) => (x.key === key ? { ...x, [`alt${lang}`]: value } : x)));
  };

  const onRetry = (key: string) => {
    setPhotos((p) => p.map((x) => (x.key === key ? { ...x, state: "waiting", error: undefined } : x)));
  };

  // ----- checks in the browser (the server checks everything again) -----
  const firstFocus = (ids: string[]) => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        (el as HTMLElement).focus?.({ preventScroll: true });
        return;
      }
    }
  };

  const checkInBrowser = (sending: boolean): boolean => {
    const parsed = validateListingValues(values);
    const fieldErrs: FieldErrors = parsed.ok ? {} : parsed.errors;
    const noPhoto = isOwner && sending && photos.length === 0;
    const noTicks = isOwner && sending && isDraft && !(tickOwner && tickPhone);
    setErrors(fieldErrs);
    setPhotoRequired(noPhoto);
    setTickErr(noTicks);
    const bad = Object.keys(fieldErrs).length > 0 || noPhoto || noTicks;
    setShowSummary(bad);
    if (bad) {
      const order: string[] = [];
      if (noPhoto) order.push("field-photos");
      for (const f of LISTING_FIELDS) if (fieldErrs[f]) order.push(`field-${f}`);
      if (noTicks) order.push("field-tickOwner");
      window.setTimeout(() => firstFocus(order), 0);
    }
    return !bad;
  };

  // ----- the sequence: save text -> upload photos one by one -> (send) -----
  const run = async (intent: "submit" | "draft" | "save") => {
    if (busy) return;
    setFormError(null);
    setNotice(null);
    setIssues([]);
    if (!checkInBrowser(intent === "submit")) return;

    setStage("saving");
    const saved = await actions.save(listingId, values);
    if (!saved.ok) {
      setStage(null);
      if (saved.fieldErrors) {
        setErrors(saved.fieldErrors);
        setShowSummary(true);
        window.setTimeout(() => firstFocus(LISTING_FIELDS.filter((f) => saved.fieldErrors?.[f]).map((f) => `field-${f}`)), 0);
      } else {
        setFormError(actionErrorText(saved.error, saved.count));
      }
      return;
    }
    const id = saved.listingId;
    setListingId(id);

    // Photos, one request each. Already-saved photos are never sent again.
    const waiting = photosRef.current.filter((p) => p.file && p.state !== "saved");
    let uploadedAny = false;
    let failures = 0;
    for (let n = 0; n < waiting.length; n++) {
      const item = waiting[n];
      setStage("uploading");
      setUploadLine(tf("photoUploading", { current: n + 1, total: waiting.length }));
      setPhotos((p) => p.map((x) => (x.key === item.key ? { ...x, state: "uploading", error: undefined } : x)));
      const fd = new FormData();
      fd.set("listingId", id);
      fd.set("file", item.file as File);
      fd.set("altEn", item.altEn);
      fd.set("altAr", item.altAr);
      let res;
      try {
        res = await actions.uploadPhoto(fd);
      } catch {
        res = { ok: false as const, error: "photoFailed" as ActionError };
      }
      if (res.ok) {
        uploadedAny = true;
        if (item.preview) URL.revokeObjectURL(item.preview);
        setPhotos((p) => p.map((x) => x.key === item.key
          ? { ...x, id: res.image.id, path: res.image.path, preview: undefined, file: undefined,
              savedAltEn: x.altEn, savedAltAr: x.altAr, state: "saved", error: undefined }
          : x));
      } else {
        failures++;
        const msg = photoErrorText(res.error, item.file?.name ?? "");
        setPhotos((p) => p.map((x) => (x.key === item.key ? { ...x, state: "failed", error: msg } : x)));
        if (res.error === "rateLimited") break; // no point trying the rest
      }
    }
    setUploadLine(null);

    if (failures > 0) {
      setStage(null);
      setFormError(tf("partialFail"));
      if (mode === "create" && !initialId) router.refresh();
      return;
    }

    // Apply the final order (cover first) and any changed descriptions.
    const current = photosRef.current;
    if (current.every((p) => p.id)) {
      if (uploadedAny || orderDirty.current) {
        await actions.setPhotoOrder(id, current.map((p) => p.id as string));
        orderDirty.current = false;
      }
      for (const p of current) {
        if (p.id && (p.altEn !== (p.savedAltEn ?? "") || p.altAr !== (p.savedAltAr ?? ""))) {
          await actions.describePhoto(id, p.id, { altEn: p.altEn, altAr: p.altAr });
        }
      }
    }

    if (intent === "submit") {
      setStage("sending");
      const sent = await actions.sendForReview(id, { owner: tickOwner, phone: tickPhone });
      if (!sent.ok) {
        setStage(null);
        if (sent.error === "photoRequired") setPhotoRequired(true);
        if (sent.error === "confirmRequired") setTickErr(true);
        setFormError(actionErrorText(sent.error, sent.count));
        return;
      }
      clearDraft();
      router.push(successHref);
      return;
    }

    // Saved without sending.
    clearDraft();
    setTouched(false);
    setStage(null);
    if (mode === "create" && !initialId) {
      router.replace(`${editHrefBase}/${id}`);
      return;
    }
    setNotice(
      status === "ACTIVE" && saved.status === "PENDING_REVIEW"
        ? t("savedGoingToReview")
        : intent === "draft" ? t("savedDraft") : t("saved"),
    );
    router.refresh();
  };

  // ----- pieces -----
  const invalid = (name: ListingField) => Boolean(errors[name]);
  const priceNumber = Number(toLatinNumber(v("price")));
  const showPrice = Number.isFinite(priceNumber) && priceNumber > 0;
  const req = <span className="ms-1 text-xs font-normal text-stone-500 dark:text-stone-400">{tf("required")}</span>;
  const opt = <span className="ms-1 text-xs font-normal text-stone-500 dark:text-stone-400">{tf("optional")}</span>;
  const summaryNames = (Object.keys(errors) as ListingField[]);

  const labelFor = (f: ListingField): string => {
    switch (f) {
      case "neighborhoodId": return ta("neighborhood");
      case "type": return ta("property.type");
      case "ownership": return ta("property.ownership");
      case "titleEn": return ta("property.titleEn");
      case "titleAr": return ta("property.titleAr");
      case "descriptionEn": return ta("property.descriptionEn");
      case "descriptionAr": return ta("property.descriptionAr");
      case "bedrooms": return ta("property.bedrooms");
      case "bathrooms": return ta("property.bathrooms");
      case "areaSqm": return ta("property.areaSqm");
      case "yearBuilt": return ta("property.yearBuilt");
      case "listingType": return ta("listing.listingType");
      case "price": return ta("listing.price");
      case "rentPeriod": return ta("listing.rentPeriod");
    }
  };

  const submitLabel =
    stage === "saving" ? tf("saving")
    : stage === "uploading" ? (uploadLine ?? tf("saving"))
    : stage === "sending" ? tf("sending")
    : null;
  const primaryIntent: "submit" | "save" = mode === "create" || isDraft ? "submit" : "save";

  return (
    <form
      noValidate
      onSubmit={(e) => { e.preventDefault(); void run(primaryIntent); }}
      id="listing-form"
      className="space-y-6"
    >
      {foundDraft && (
        <div role="status" className="space-y-3 rounded-xl bg-sky-50 p-4 text-sm text-sky-900 ring-1 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-100">
          <p className="font-medium">{tf("draftFound")}</p>
          <p className="text-xs">{tf("draftPhotosNote")}</p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => { setValues({ ...DEFAULTS, ...foundDraft }); setFoundDraft(null); setRestored(true); setTouched(true); window.setTimeout(() => setRestored(false), 4000); }}>
              {tf("draftRestore")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => { clearDraft(); setFoundDraft(null); }}>
              {tf("draftDiscard")}
            </Button>
          </div>
        </div>
      )}
      {restored && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{tf("draftRestored")}</p>}

      {showSummary && (summaryNames.length > 0 || photoRequired || tickErr) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">
          <p className="font-medium">{t("errors.summary")}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            {photoRequired && (
              <li><a className="underline" href="#field-photos" onClick={(e) => { e.preventDefault(); firstFocus(["field-photos"]); }}>{tf("photosTitle")}</a></li>
            )}
            {summaryNames.map((f) => (
              <li key={f}>
                <a className="underline" href={`#field-${f}`} onClick={(e) => { e.preventDefault(); firstFocus([`field-${f}`]); }}>
                  {labelFor(f)}
                </a>
              </li>
            ))}
            {tickErr && <li>{to("tickRequired")}</li>}
          </ul>
        </div>
      )}

      <PhotoBox
        photos={photos}
        busy={busy}
        issues={issues}
        requiredError={photoRequired}
        uploadLine={uploadLine}
        optional={!isOwner}
        onAddFiles={addFiles}
        onMove={onMove}
        onRemove={onRemove}
        onRetry={onRetry}
        onAlt={onAlt}
      />

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{tf("propertyTitle")}</h2>
          {touched && <span className="text-xs text-stone-500 dark:text-stone-400">✓ {tf("draftKept")}</span>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="field-neighborhoodId">{ta("neighborhood")}{req}</Label>
            <Select id="field-neighborhoodId" value={v("neighborhoodId")} disabled={busy}
              onChange={(e) => set("neighborhoodId", e.target.value)} error={invalid("neighborhoodId")}>
              <option value="" disabled>{tf("selectPlaceholder")}</option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {localName(locale, n.city.nameEn, n.city.nameAr)} — {localName(locale, n.nameEn, n.nameAr)}
                </option>
              ))}
            </Select>
            <FieldError>{errText(errors.neighborhoodId)}</FieldError>
          </div>
          <div>
            <Label htmlFor="field-type">{ta("property.type")}{req}</Label>
            <Select id="field-type" value={v("type")} disabled={busy}
              onChange={(e) => set("type", e.target.value)} error={invalid("type")}>
              {PROPERTY_TYPES.map((pt) => <option key={pt} value={pt}>{te(`propertyType.${pt}`)}</option>)}
            </Select>
            <FieldError>{errText(errors.type)}</FieldError>
          </div>
          <div>
            <Label htmlFor="field-ownership">{ta("property.ownership")}{opt}</Label>
            <Select id="field-ownership" value={v("ownership")} disabled={busy}
              onChange={(e) => set("ownership", e.target.value)} error={invalid("ownership")}>
              {OWNERSHIP.map((o) => <option key={o} value={o}>{te(`ownership.${o}`)}</option>)}
            </Select>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{tf("tipOwnership")}</p>
            <FieldError>{errText(errors.ownership)}</FieldError>
          </div>
          <div>
            <Label htmlFor="field-yearBuilt">{ta("property.yearBuilt")}{opt}</Label>
            <Input id="field-yearBuilt" inputMode="numeric" value={v("yearBuilt")} disabled={busy}
              onChange={(e) => set("yearBuilt", e.target.value)} placeholder={ta("examples.yearBuilt")}
              error={invalid("yearBuilt")} />
            <FieldError>{errText(errors.yearBuilt)}</FieldError>
          </div>
        </div>

        <div>
          <Label htmlFor="field-titleEn">{ta("property.titleEn")}{req}</Label>
          <Input id="field-titleEn" dir="ltr" maxLength={200} value={v("titleEn")} disabled={busy}
            onChange={(e) => set("titleEn", e.target.value)} placeholder={ta("examples.titleEn")}
            error={invalid("titleEn")} />
          <FieldError>{errText(errors.titleEn)}</FieldError>
        </div>
        <div>
          <Label htmlFor="field-titleAr">{ta("property.titleAr")}{opt}</Label>
          <Input id="field-titleAr" dir="rtl" maxLength={200} value={v("titleAr")} disabled={busy}
            onChange={(e) => set("titleAr", e.target.value)} placeholder={ta("examples.titleAr")}
            error={invalid("titleAr")} />
          <FieldError>{errText(errors.titleAr)}</FieldError>
        </div>
        <div>
          <Label htmlFor="field-descriptionEn">{ta("property.descriptionEn")}{opt}</Label>
          <Textarea id="field-descriptionEn" dir="ltr" maxLength={MAX_DESCRIPTION} value={v("descriptionEn")} disabled={busy}
            onChange={(e) => set("descriptionEn", e.target.value)} placeholder={ta("examples.descriptionEn")}
            error={invalid("descriptionEn")} />
          <p className="mt-1 text-end text-xs text-stone-500 dark:text-stone-400" dir="ltr">{v("descriptionEn").length} / {MAX_DESCRIPTION}</p>
          <FieldError>{errText(errors.descriptionEn)}</FieldError>
        </div>
        <div>
          <Label htmlFor="field-descriptionAr">{ta("property.descriptionAr")}{opt}</Label>
          <Textarea id="field-descriptionAr" dir="rtl" maxLength={MAX_DESCRIPTION} value={v("descriptionAr")} disabled={busy}
            onChange={(e) => set("descriptionAr", e.target.value)} placeholder={ta("examples.descriptionAr")}
            error={invalid("descriptionAr")} />
          <p className="mt-1 text-end text-xs text-stone-500 dark:text-stone-400" dir="ltr">{v("descriptionAr").length} / {MAX_DESCRIPTION}</p>
          <FieldError>{errText(errors.descriptionAr)}</FieldError>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="field-bedrooms">{ta("property.bedrooms")}{opt}</Label>
            <Input id="field-bedrooms" inputMode="numeric" value={v("bedrooms")} disabled={busy}
              onChange={(e) => set("bedrooms", e.target.value)} placeholder={ta("examples.bedrooms")}
              error={invalid("bedrooms")} />
            <FieldError>{errText(errors.bedrooms)}</FieldError>
          </div>
          <div>
            <Label htmlFor="field-bathrooms">{ta("property.bathrooms")}{opt}</Label>
            <Input id="field-bathrooms" inputMode="numeric" value={v("bathrooms")} disabled={busy}
              onChange={(e) => set("bathrooms", e.target.value)} placeholder={ta("examples.bathrooms")}
              error={invalid("bathrooms")} />
            <FieldError>{errText(errors.bathrooms)}</FieldError>
          </div>
          <div>
            <Label htmlFor="field-areaSqm">{ta("property.areaSqm")}{opt}</Label>
            <Input id="field-areaSqm" inputMode="decimal" value={v("areaSqm")} disabled={busy}
              onChange={(e) => set("areaSqm", e.target.value)} placeholder={ta("examples.areaSqm")}
              error={invalid("areaSqm")} />
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{tf("tipArea")}</p>
            <FieldError>{errText(errors.areaSqm)}</FieldError>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{tf("offerTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="field-listingType">{ta("listing.listingType")}{req}</Label>
            <Select id="field-listingType" value={v("listingType")} disabled={busy}
              onChange={(e) => set("listingType", e.target.value)} error={invalid("listingType")}>
              <option value="SALE">{tp("sale")}</option>
              <option value="RENT">{tp("rent")}</option>
            </Select>
            <FieldError>{errText(errors.listingType)}</FieldError>
          </div>
          <div>
            <Label htmlFor="field-price">{ta("listing.price")}{req}</Label>
            <div className="relative">
              <Input id="field-price" inputMode="decimal" value={v("price")} disabled={busy}
                onChange={(e) => set("price", e.target.value)} placeholder={ta("examples.price")}
                className="pe-14" error={invalid("price")} />
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-medium text-stone-500 dark:text-stone-400">
                {tf("unitOmr")}
              </span>
            </div>
            {showPrice && (
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                {tf("priceSeen", { price: formatOMRWhole(priceNumber, locale) })}
              </p>
            )}
            <FieldError>{errText(errors.price)}</FieldError>
          </div>
          {v("listingType") === "RENT" && (
            <div>
              <Label htmlFor="field-rentPeriod">{ta("listing.rentPeriod")}{req}</Label>
              <Select id="field-rentPeriod" value={v("rentPeriod") || "MONTHLY"} disabled={busy}
                onChange={(e) => set("rentPeriod", e.target.value)} error={invalid("rentPeriod")}>
                <option value="MONTHLY">{te("rentPeriod.MONTHLY")}</option>
                <option value="ANNUAL">{te("rentPeriod.ANNUAL")}</option>
              </Select>
              <FieldError>{errText(errors.rentPeriod)}</FieldError>
            </div>
          )}
        </div>
      </Card>

      {isOwner && isDraft && (
        <Card className="space-y-3">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-stone-800 dark:text-stone-200">
            <input id="field-tickOwner" type="checkbox" checked={tickOwner} disabled={busy}
              onChange={(e) => { setTickOwner(e.target.checked); setTickErr(false); }}
              className={`mt-0.5 size-5 shrink-0 rounded ${tickErr && !tickOwner ? "outline outline-2 outline-rose-600" : ""}`} />
            <span>{to("ownerConfirm")}</span>
          </label>
          {tickErr && !tickOwner && <FieldError>{to("tickRequired")}</FieldError>}
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-stone-800 dark:text-stone-200">
            <input id="field-tickPhone" type="checkbox" checked={tickPhone} disabled={busy}
              onChange={(e) => { setTickPhone(e.target.checked); setTickErr(false); }}
              className={`mt-0.5 size-5 shrink-0 rounded ${tickErr && !tickPhone ? "outline outline-2 outline-rose-600" : ""}`} />
            <span>
              {to("phoneConsent", { phone: "⁦" + (ownerPhone ?? "") + "⁩" })}
            </span>
          </label>
          {tickErr && !tickPhone && <FieldError>{to("tickRequired")}</FieldError>}
          <p className="text-xs text-stone-500 dark:text-stone-400">{to("reviewNotice")}</p>
        </Card>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-stone-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 dark:border-stone-800 dark:bg-stone-950/95 sm:dark:bg-transparent">
        {formError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">{formError}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-100">{notice}</p>}
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          <Button type="submit" disabled={busy} className="w-full sm:w-auto" aria-busy={busy}>
            {submitLabel ?? (primaryIntent === "submit" ? tf("submit") : tf("saveChanges"))}
          </Button>
          {primaryIntent === "submit" && (
            <Button type="button" variant="secondary" disabled={busy} className="w-full sm:w-auto" onClick={() => void run("draft")}>
              {tf("saveDraft")}
            </Button>
          )}
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          {isLive ? tf("editNotice") : tf("submitNotice")}
        </p>
      </div>
    </form>
  );
}
