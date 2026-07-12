import { getLocale, getTranslations } from "next-intl/server";
import type { ListingStatus } from "@prisma/client";
import { adminListListings } from "@/lib/db/listings";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName } from "@/lib/i18nData";
import { StatusPill } from "@/components/marketplace/StatusPill";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";

const STATUSES: ListingStatus[] = [
  "DRAFT", "PENDING_REVIEW", "ACTIVE", "REJECTED", "SOLD", "RENTED", "ARCHIVED",
];

export default async function ListingsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; deleted?: string }>;
}) {
  const { status, deleted } = await searchParams;
  const statusFilter = STATUSES.includes(status as ListingStatus)
    ? (status as ListingStatus)
    : undefined;

  const [t, tp, locale, listings] = await Promise.all([
    getTranslations("admin"),
    getTranslations("properties"),
    getLocale(),
    adminListListings(statusFilter),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900">{t("listings")}</h1>
        <ButtonLink href="/admin/listings/new">{t("newListing")}</ButtonLink>
      </div>

      {deleted && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
          {t("deleted")}
        </p>
      )}

      {/* Status filter row */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/listings"
          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
            !statusFilter
              ? "bg-teal-800 text-white ring-teal-800"
              : "bg-white text-stone-600 ring-stone-300 hover:bg-stone-100"
          }`}
        >
          {t("allStatuses")}
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={{ pathname: "/admin/listings", query: { status: s } }}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              statusFilter === s
                ? "bg-teal-800 text-white ring-teal-800"
                : "bg-white text-stone-600 ring-stone-300 hover:bg-stone-100"
            }`}
          >
            <StatusPillLabel status={s} />
          </Link>
        ))}
      </div>

      {listings.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="font-medium text-stone-700">{t("table.empty")}</p>
          <p className="mt-1 text-sm text-stone-500">{t("table.emptyListingsHint")}</p>
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs text-stone-500">
                <th className="px-4 py-3 text-start font-medium">{t("listing.property")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("listing.listingType")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("listing.price")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("listing.status")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("table.source")}</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/listings/${l.id}`}
                      className="font-medium text-stone-900 hover:text-teal-800"
                    >
                      {localName(locale, l.property.titleEn, l.property.titleAr)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {l.listingType === "SALE" ? tp("sale") : tp("rent")}
                  </td>
                  <td className="px-4 py-3">
                    {formatOMRWhole(decimalToNumber(l.price)!, locale)}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={l.status} /></td>
                  <td className="px-4 py-3">
                    <ProvenanceBadge provenance={l.provenance} confidence={l.confidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// tiny wrapper so the filter chips reuse enum translations without pill styling
import { useTranslations } from "next-intl";
function StatusPillLabel({ status }: { status: ListingStatus }) {
  const te = useTranslations("enums");
  return <>{te(`listingStatus.${status}`)}</>;
}
