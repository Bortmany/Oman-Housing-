import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { Link } from "@/i18n/navigation";
import { enforceAdminPage } from "@/lib/require-admin";
import { isAgencyUploadNote } from "@/lib/csv/agencyUpload";
import { canMarkVerified, isOwnersFirstListing, REVIEW_NOTE_MAX } from "@/lib/listings/rules";
import {
  approveListing,
  rejectListing,
  rejectStat,
  removeReviewPhoto,
  verifyProperty,
  verifyStat,
} from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("review.title") };
}

export default async function AdminReviewPage() {
  await enforceAdminPage(); // guard BEFORE any DB query (see require-admin.ts)
  const [t, tr, te, tp, locale] = await Promise.all([
    getTranslations("admin"),
    getTranslations("admin.review"),
    getTranslations("enums"),
    getTranslations("properties"),
    getLocale(),
  ]);

  const [pendingListings, unverifiedProps, unverifiedStats] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "PENDING_REVIEW" },
      include: {
        property: { include: { neighborhood: true } },
        agency: { select: { nameEn: true, nameAr: true } },
        createdBy: { select: { name: true, email: true, phone: true, phoneVerifiedAt: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.property.findMany({
      where: {
        provenance: "USER_SUBMITTED",
        verifiedAt: null,
        // A property whose only listings are unfinished drafts is not in the queue.
        OR: [{ listings: { none: {} } }, { listings: { some: { status: { not: "DRAFT" } } } }],
      },
      include: { neighborhood: true, listings: { select: { agencyId: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.marketStat.findMany({
      where: { provenance: "USER_SUBMITTED", verifiedAt: null },
      include: { neighborhood: true, city: true, governorate: true },
      orderBy: { periodStart: "desc" },
      take: 100,
    }),
  ]);

  // Photos for the pending listings' properties, and which owners have never
  // had a listing published (the "Owner's first listing" flag is worked out,
  // not stored).
  const propertyIds = pendingListings.map((l) => l.propertyId);
  const ownerIds = [...new Set(pendingListings.filter((l) => !l.agencyId).map((l) => l.createdById))];
  const [images, publishedByOwner] = await Promise.all([
    propertyIds.length
      ? prisma.propertyImage.findMany({
          where: { propertyId: { in: propertyIds } },
          orderBy: { sortOrder: "asc" },
        })
      : [],
    ownerIds.length
      ? prisma.listing.groupBy({
          by: ["createdById"],
          where: { createdById: { in: ownerIds }, agencyId: null, publishedAt: { not: null } },
          _count: { _all: true },
        })
      : [],
  ]);
  const publishedCount = new Map(publishedByOwner.map((r) => [r.createdById, r._count._all]));

  const total = pendingListings.length + unverifiedProps.length + unverifiedStats.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("review.title")}</h1>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{t("review.subtitle")}</p>

      {total === 0 && (
        <Card className="mt-6 text-center text-sm text-stone-500 dark:text-stone-400">
          {t("review.allClear")}
        </Card>
      )}

      {/* Agency listings awaiting publish */}
      {pendingListings.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {t("review.pendingListings")} ({pendingListings.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {pendingListings.map((l) => {
              const isOwner = !l.agencyId;
              const first = isOwner && isOwnersFirstListing(publishedCount.get(l.createdById) ?? 0);
              const edited = l.publishedAt != null;
              const photos = images.filter((i) => i.propertyId === l.propertyId);
              return (
                <li key={l.id}>
                  <Card className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {isOwner && (
                        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                          {tr("ownerListing")}
                        </span>
                      )}
                      {first && (
                        <span title={tr("firstTip")} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          ⚑ {tr("ownerFirst")}
                        </span>
                      )}
                      {edited && (
                        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                          {tr("editOfReviewed")}
                        </span>
                      )}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="min-w-0 space-y-2">
                        <p className="font-medium text-stone-900 dark:text-stone-100">
                          {localName(locale, l.property.titleEn, l.property.titleAr)}
                        </p>
                        <p className="text-sm text-stone-500 dark:text-stone-400">
                          {l.listingType === "SALE" ? tp("sale") : tp("rent")} ·{" "}
                          {formatOMRWhole(decimalToNumber(l.price)!, locale)} ·{" "}
                          {te(`propertyType.${l.property.type}`)} ·{" "}
                          {localName(locale, l.property.neighborhood.nameEn, l.property.neighborhood.nameAr)}
                          {l.agency && (
                            <span className="ms-2">
                              · {localName(locale, l.agency.nameEn, l.agency.nameAr)}
                            </span>
                          )}
                        </p>
                        <div className="rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-800">
                          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{tr("seller")}</p>
                          <p className="text-stone-900 dark:text-stone-100">{l.createdBy.name ?? l.createdBy.email}</p>
                          <p className="break-all text-stone-600 dark:text-stone-300" dir="ltr">{l.createdBy.email}</p>
                          {l.createdBy.phone && (
                            <p className="text-stone-600 dark:text-stone-300">
                              <bdi dir="ltr">{l.createdBy.phone}</bdi>
                              {isOwner && l.createdBy.phoneVerifiedAt && (
                                <span title={tr("phoneTip")} className="ms-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  {tr("phoneVerified")}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        {(l.property.descriptionEn || l.property.descriptionAr) && (
                          <details className="text-sm text-stone-600 dark:text-stone-300">
                            <summary className="cursor-pointer text-teal-800 dark:text-teal-300">
                              {(l.property.descriptionEn ?? l.property.descriptionAr ?? "").slice(0, 80)}…
                            </summary>
                            {l.property.descriptionEn && <p className="mt-2 whitespace-pre-line" dir="ltr">{l.property.descriptionEn}</p>}
                            {l.property.descriptionAr && <p className="mt-2 whitespace-pre-line" dir="rtl">{l.property.descriptionAr}</p>}
                          </details>
                        )}
                      </div>

                      <div className="min-w-0 space-y-3">
                        <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{tr("photos")}</p>
                        {photos.length === 0 ? (
                          <p className="text-sm text-stone-500 dark:text-stone-400">
                            {tr("noPhotos")} {isOwner && tr("noPhotosLeft")}
                          </p>
                        ) : (
                          <ul className="grid grid-cols-3 gap-2">
                            {photos.map((img) => (
                              <li key={img.id} className="min-w-0">
                                <a href={`/api/images/${img.storagePath}`} target="_blank" rel="noopener noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={`/api/images/${img.storagePath}`} alt={img.altEn ?? ""} className="aspect-square w-full rounded-lg object-cover ring-1 ring-stone-200 dark:ring-stone-700" />
                                </a>
                                <form action={removeReviewPhoto}>
                                  <input type="hidden" name="id" value={img.id} />
                                  <button className="mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950">
                                    {tr("removePhoto")}
                                  </button>
                                </form>
                              </li>
                            ))}
                          </ul>
                        )}

                        <form action={approveListing}>
                          <input type="hidden" name="id" value={l.id} />
                          <button className="min-h-11 w-full rounded-lg bg-teal-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 active:bg-teal-900">
                            {t("review.publish")}
                          </button>
                        </form>
                        <form action={rejectListing} className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-800">
                          <input type="hidden" name="id" value={l.id} />
                          <label htmlFor={`note-${l.id}`} className="block text-xs font-medium text-stone-600 dark:text-stone-300">{tr("rejectReason")}</label>
                          <textarea id={`note-${l.id}`} name="note" rows={2} maxLength={REVIEW_NOTE_MAX}
                            className="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-teal-700 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700" />
                          <button className="min-h-11 w-full rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 ring-1 ring-stone-300 hover:bg-stone-100 active:bg-stone-200 dark:bg-stone-900 dark:text-rose-400 dark:ring-stone-700 dark:hover:bg-stone-800">
                            {t("review.reject")}
                          </button>
                        </form>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* User-submitted properties awaiting verification */}
      {unverifiedProps.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {t("review.unverifiedProperties")} ({unverifiedProps.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {unverifiedProps.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/properties/${p.id}`}
                      className="font-medium text-stone-900 hover:text-teal-800 dark:text-stone-100 dark:hover:text-teal-300"
                    >
                      {localName(locale, p.titleEn, p.titleAr)}
                    </Link>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {te(`propertyType.${p.type}`)} ·{" "}
                      {localName(locale, p.neighborhood.nameEn, p.neighborhood.nameAr)}
                      <span className="ms-2">
                        <ProvenanceBadge provenance={p.provenance} confidence={p.confidence} isSample={p.isSample} />
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/properties/${p.id}`}
                      className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-800"
                    >
                      {t("review.openEditor")}
                    </Link>
                    {/* Invented sample rows can never be marked verified (house rule 1). */}
                    {!p.isSample && canMarkVerified(p.listings) && (
                      <form action={verifyProperty}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600">
                          {t("review.markVerified")}
                        </button>
                      </form>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* User-submitted market stats awaiting verification */}
      {unverifiedStats.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {t("review.unverifiedStats")} ({unverifiedStats.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {unverifiedStats.map((s) => {
              const scope = s.neighborhood
                ? localName(locale, s.neighborhood.nameEn, s.neighborhood.nameAr)
                : s.city
                  ? localName(locale, s.city.nameEn, s.city.nameAr)
                  : s.governorate
                    ? t("review.governorateScope", {
                        name: localName(locale, s.governorate.nameEn, s.governorate.nameAr),
                      })
                    : t("review.nationalScope");
              return (
                <li key={s.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-stone-900 dark:text-stone-100">{scope}</p>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        {s.periodStart.toISOString().slice(0, 7)}
                        {s.propertyType && ` · ${te(`propertyType.${s.propertyType}`)}`}
                        <span className="ms-2">
                          <ProvenanceBadge provenance={s.provenance} confidence={s.confidence} isSample={s.isSample} />
                        </span>
                      </p>
                      {(s.sourceNote || s.sourceUrl) && (
                        <div className="mt-2 flex flex-wrap items-start gap-2 text-sm text-stone-600 dark:text-stone-300">
                          {isAgencyUploadNote(s.sourceNote) && (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                              {t("review.agencyUpload")}
                            </span>
                          )}
                          {s.sourceNote && (
                            <details className="group min-w-0 max-w-prose">
                              <summary className="line-clamp-2 cursor-pointer group-open:line-clamp-none">
                                {s.sourceNote}
                              </summary>
                            </details>
                          )}
                          {s.sourceUrl && /^https?:\/\//i.test(s.sourceUrl) && (
                            <a
                              href={s.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={s.sourceUrl}
                              className="whitespace-nowrap text-teal-800 hover:underline dark:text-teal-300"
                            >
                              {t("review.sourceLink")} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">↗</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {/* Invented sample rows can never be marked verified (house rule 1). */}
                      {!s.isSample && (
                        <form action={verifyStat}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600">
                            {t("review.markVerified")}
                          </button>
                        </form>
                      )}
                      <form action={rejectStat}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 ring-1 ring-stone-300 hover:bg-stone-100 dark:bg-stone-900 dark:text-rose-400 dark:ring-stone-700 dark:hover:bg-stone-800">
                          {t("review.reject")}
                        </button>
                      </form>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
