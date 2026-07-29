import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { decimalToString } from "@/lib/money";
import { formatMonth, localName } from "@/lib/i18nData";
import { ListingForm } from "../ListingForm";
import { publishListing, rejectListing, archiveListing, deleteListing } from "../actions";
import { StatusPill } from "@/components/marketplace/StatusPill";
import { Button } from "@/components/ui/Button";
import { DirectionalLink } from "@/components/ui/DirectionalLink";

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [t, tc, locale, listing, properties] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    getLocale(),
    prisma.listing.findUnique({
      where: { id },
      include: { property: { select: { id: true, titleEn: true, titleAr: true } } },
    }),
    prisma.property.findMany({
      orderBy: { titleEn: "asc" },
      select: { id: true, titleEn: true, titleAr: true },
    }),
  ]);
  if (!listing) notFound();

  const moderation: Array<{
    action: (formData: FormData) => Promise<void>;
    label: string;
    show: boolean;
    variant: "primary" | "secondary" | "danger";
  }> = [
    { action: publishListing, label: t("publish"), variant: "primary",
      show: listing.status !== "ACTIVE" && listing.status !== "ARCHIVED" },
    { action: rejectListing, label: t("reject"), variant: "secondary",
      show: listing.status === "PENDING_REVIEW" || listing.status === "ACTIVE" },
    { action: archiveListing, label: t("archiveAction"), variant: "secondary",
      show: listing.status !== "ARCHIVED" },
    { action: deleteListing, label: tc("delete"), variant: "danger", show: true },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <DirectionalLink
        direction="back"
        href="/admin/listings"
        className="text-sm text-teal-800 hover:underline"
      >
        {t("listings")}
      </DirectionalLink>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-stone-900">{t("editListing")}</h1>
          <StatusPill status={listing.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {moderation
            .filter((m) => m.show)
            .map((m) => (
              <form key={m.label} action={m.action}>
                <input type="hidden" name="id" value={listing.id} />
                <Button type="submit" variant={m.variant} className="!px-3 !py-1.5 text-xs">
                  {m.label}
                </Button>
              </form>
            ))}
        </div>
      </div>

      <p className="mt-2 text-sm text-stone-500">
        {localName(locale, listing.property.titleEn, listing.property.titleAr)}
        {listing.publishedAt && (
          <> · {t("listing.publishedAt")}: {formatMonth(locale, listing.publishedAt)}</>
        )}
      </p>

      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
          {t("saved")}
        </p>
      )}

      <div className="mt-6">
        <ListingForm
          properties={properties}
          defaults={{
            id: listing.id,
            propertyId: listing.propertyId,
            listingType: listing.listingType,
            price: decimalToString(listing.price) ?? "",
            rentPeriod: listing.rentPeriod,
            provenance: listing.provenance,
            confidence: listing.confidence,
          }}
        />
      </div>
    </div>
  );
}
