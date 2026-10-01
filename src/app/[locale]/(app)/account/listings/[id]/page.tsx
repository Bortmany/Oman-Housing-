import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { enforceOwnerPage, ownerPhoneRow } from "@/lib/listings/ownerGuard";
import { listingForActor, slotsUsed } from "@/lib/listings/core";
import { ownerHasSlot, type ListingValues } from "@/lib/listings/rules";
import { verifiedPhoneOf } from "@/lib/phoneVerify";
import { inquiriesForOwnerListing } from "@/lib/db/inquiries";
import { allNeighborhoods } from "@/lib/db/market-stats";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { formatDateTime, localName } from "@/lib/i18nData";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DirectionalLink } from "@/components/ui/DirectionalLink";
import { InquiryStatusPill } from "@/components/marketplace/InquiryStatusPill";
import { ListingForm } from "@/components/listing-form/ListingForm";
import { ListingActionsPanel } from "@/components/listing-form/ListingActionsPanel";
import { OwnStatusPill } from "@/components/listing-form/OwnStatusPill";
import { ownerFormActions, ownerPanelActions } from "../formActions";

export default async function OwnerListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await enforceOwnerPage(); // guard BEFORE any query
  const { id } = await params;

  // One query that asks for "this id AND this owner" — a listing that is
  // missing and one that is someone else's both come back empty, and both get
  // the same standard not-found page.
  const listing = await listingForActor(actor, id);
  if (!listing) notFound();

  const [t, tm, te, tp, locale, neighborhoods, enquiries, phoneRow, used] = await Promise.all([
    getTranslations("owner"),
    getTranslations("myListing"),
    getTranslations("enums"),
    getTranslations("properties"),
    getLocale(),
    allNeighborhoods(),
    inquiriesForOwnerListing(actor.userId, listing.id),
    ownerPhoneRow(actor.userId),
    slotsUsed(actor),
  ]);

  const p = listing.property;
  const title = localName(locale, p.titleEn, p.titleAr);
  const cover = p.images[0];
  const num = (n: number | null | undefined) => (n == null ? "" : String(n));
  const initialValues: ListingValues = {
    neighborhoodId: p.neighborhoodId,
    type: p.type,
    ownership: p.ownership,
    titleEn: p.titleEn,
    titleAr: p.titleAr ?? "",
    descriptionEn: p.descriptionEn ?? "",
    descriptionAr: p.descriptionAr ?? "",
    bedrooms: num(p.bedrooms),
    bathrooms: num(p.bathrooms),
    areaSqm: num(decimalToNumber(p.areaSqm)),
    yearBuilt: num(p.yearBuilt),
    listingType: listing.listingType,
    price: num(decimalToNumber(listing.price)),
    rentPeriod: listing.rentPeriod ?? "MONTHLY",
  };
  const capMessage =
    !ownerHasSlot(used) ? tm("errors.capReached") : null;
  const dateFmt = (d: Date) => formatDateTime(locale, d);
  const live = listing.status === "ACTIVE";

  const side = (
    <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <Card className="flex items-center gap-3">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/images/${cover.storagePath}`} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-stone-100 text-center text-[10px] text-stone-500 dark:bg-stone-800">{tp("noPhotos")}</div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-teal-800 dark:text-teal-300">
            {formatOMRWhole(decimalToNumber(listing.price)!, locale)}
            {listing.listingType === "RENT" && listing.rentPeriod && (
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400"> {te(`rentPeriod.${listing.rentPeriod}`)}</span>
            )}
          </p>
          <p className="truncate text-xs text-stone-500 dark:text-stone-400">
            {localName(locale, p.neighborhood.nameEn, p.neighborhood.nameAr)}
          </p>
        </div>
      </Card>
      {live && (
        <ButtonLink href={`/properties/${p.id}`} variant="secondary" className="w-full">{tm("viewAsBuyer")}</ButtonLink>
      )}
      <ListingActionsPanel
        listingId={listing.id}
        status={listing.status}
        listingType={listing.listingType}
        actions={ownerPanelActions}
        listHref="/account/listings"
        capMessage={capMessage}
      />
      <Card className="max-h-[32rem] space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{t("list.enquiries")}</h2>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">{enquiries.length}</span>
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400">{t("list.noEmailYet")}</p>
        {enquiries.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">{t("list.enquiriesEmpty")}</p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {enquiries.map((q) => (
              <li key={q.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-stone-900 dark:text-stone-100">{q.name}</span>
                  <InquiryStatusPill status={q.status} />
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400">{dateFmt(q.createdAt)}</p>
                <p className="line-clamp-3 whitespace-pre-line text-sm text-stone-700 dark:text-stone-300">{q.message}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {q.phone && (
                    <a href={`tel:${q.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-teal-800 ring-1 ring-stone-300 hover:bg-stone-100 dark:text-teal-300 dark:ring-stone-700 dark:hover:bg-stone-800">
                      {t("list.call")}
                    </a>
                  )}
                  <a href={`mailto:${q.email}`} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-teal-800 ring-1 ring-stone-300 hover:bg-stone-100 dark:text-teal-300 dark:ring-stone-700 dark:hover:bg-stone-800">
                    {t("list.email")}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <DirectionalLink direction="back" href="/account/listings" className="inline-flex min-h-11 items-center text-sm text-teal-800 hover:underline dark:text-teal-300">
        {tm("back")}
      </DirectionalLink>
      {/* Phone: title, status, then the action panel, then the form. Laptop: the
          side column (end edge) stays beside the form. */}
      <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
          <h1 className="line-clamp-2 text-2xl font-bold text-stone-900 dark:text-stone-100">{title}</h1>
          <OwnStatusPill status={listing.status} publishedBefore={listing.publishedAt != null} withHint />
          {listing.status === "REJECTED" && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-100">
              {listing.reviewNote ? tm("rejectedReason", { reason: listing.reviewNote }) : tm("noReason")}
            </p>
          )}
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">{side}</div>
        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-2">
          {live && (
            <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-100">
              {tm("form.editNotice")}
            </p>
          )}
          <ListingForm
            audience="owner"
            mode="edit"
            neighborhoods={neighborhoods}
            actions={ownerFormActions}
            successHref="/account/listings?submitted=1"
            editHrefBase="/account/listings"
            draftKey={`owner:${listing.id}`}
            listingId={listing.id}
            status={listing.status}
            initialValues={initialValues}
            initialPhotos={p.images.map((i) => ({ id: i.id, path: i.storagePath, altEn: i.altEn, altAr: i.altAr }))}
            ownerPhone={verifiedPhoneOf(phoneRow) ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
