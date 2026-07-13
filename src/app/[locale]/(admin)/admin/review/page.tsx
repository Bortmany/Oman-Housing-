import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { Link } from "@/i18n/navigation";
import { approveListing, rejectListing, verifyProperty, verifyStat } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("review.title") };
}

export default async function AdminReviewPage() {
  const [t, te, tp, locale] = await Promise.all([
    getTranslations("admin"),
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
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.property.findMany({
      where: { provenance: "USER_SUBMITTED", verifiedAt: null },
      include: { neighborhood: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.marketStat.findMany({
      where: { provenance: "USER_SUBMITTED", verifiedAt: null },
      include: { neighborhood: true, city: true },
      orderBy: { periodStart: "desc" },
      take: 100,
    }),
  ]);

  const total = pendingListings.length + unverifiedProps.length + unverifiedStats.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900">{t("review.title")}</h1>
      <p className="mt-2 text-sm text-stone-600">{t("review.subtitle")}</p>

      {total === 0 && (
        <Card className="mt-6 text-center text-sm text-stone-500">
          {t("review.allClear")}
        </Card>
      )}

      {/* Agency listings awaiting publish */}
      {pendingListings.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900">
            {t("review.pendingListings")} ({pendingListings.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {pendingListings.map((l) => (
              <li key={l.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">
                      {localName(locale, l.property.titleEn, l.property.titleAr)}
                    </p>
                    <p className="text-sm text-stone-500">
                      {l.listingType === "SALE" ? tp("sale") : tp("rent")} ·{" "}
                      {formatOMRWhole(decimalToNumber(l.price)!, locale)}
                      {l.agency && (
                        <span className="ms-2">
                          · {localName(locale, l.agency.nameEn, l.agency.nameAr)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveListing}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="rounded-lg bg-teal-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700">
                        {t("review.publish")}
                      </button>
                    </form>
                    <form action={rejectListing}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 ring-1 ring-stone-300 hover:bg-stone-100">
                        {t("review.reject")}
                      </button>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* User-submitted properties awaiting verification */}
      {unverifiedProps.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-900">
            {t("review.unverifiedProperties")} ({unverifiedProps.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {unverifiedProps.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/properties/${p.id}`}
                      className="font-medium text-stone-900 hover:text-teal-800"
                    >
                      {localName(locale, p.titleEn, p.titleAr)}
                    </Link>
                    <p className="text-sm text-stone-500">
                      {te(`propertyType.${p.type}`)} ·{" "}
                      {localName(locale, p.neighborhood.nameEn, p.neighborhood.nameAr)}
                      <span className="ms-2">
                        <ProvenanceBadge provenance={p.provenance} confidence={p.confidence} />
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/properties/${p.id}`}
                      className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
                    >
                      {t("review.openEditor")}
                    </Link>
                    <form action={verifyProperty}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600">
                        {t("review.markVerified")}
                      </button>
                    </form>
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
          <h2 className="text-lg font-semibold text-stone-900">
            {t("review.unverifiedStats")} ({unverifiedStats.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {unverifiedStats.map((s) => {
              const scope = s.neighborhood
                ? localName(locale, s.neighborhood.nameEn, s.neighborhood.nameAr)
                : s.city
                  ? localName(locale, s.city.nameEn, s.city.nameAr)
                  : t("review.nationalScope");
              return (
                <li key={s.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-stone-900">{scope}</p>
                      <p className="text-sm text-stone-500">
                        {s.periodStart.toISOString().slice(0, 7)}
                        {s.propertyType && ` · ${te(`propertyType.${s.propertyType}`)}`}
                        <span className="ms-2">
                          <ProvenanceBadge provenance={s.provenance} confidence={s.confidence} />
                        </span>
                      </p>
                    </div>
                    <form action={verifyStat}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600">
                        {t("review.markVerified")}
                      </button>
                    </form>
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
