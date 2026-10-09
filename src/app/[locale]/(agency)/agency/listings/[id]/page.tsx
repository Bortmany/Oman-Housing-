import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { enforceAgencyPage } from "@/lib/listings/agencyGuard";
import { homeEditLocked, listingForActor } from "@/lib/listings/core";
import type { ListingValues } from "@/lib/listings/rules";
import { agencyById, countListingsInPlay } from "@/lib/db/agencies";
import { allNeighborhoods } from "@/lib/db/market-stats";
import { canAddListing } from "@/lib/tiers";
import { getFreeLaunch } from "@/lib/siteSettings";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName } from "@/lib/i18nData";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DirectionalLink } from "@/components/ui/DirectionalLink";
import { ListingForm } from "@/components/listing-form/ListingForm";
import { ListingActionsPanel } from "@/components/listing-form/ListingActionsPanel";
import { OwnStatusPill } from "@/components/listing-form/OwnStatusPill";
import { FeatureCallout } from "@/components/featured/FeatureCallout";
import { agencyFormActions, agencyPanelActions } from "../formActions";

export default async function AgencyListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await enforceAgencyPage(); // guard BEFORE any query
  const { id } = await params;

  // One query that asks for "this id AND this agency" — a listing that is
  // missing and one that belongs to another agency (or to a private owner)
  // both come back empty, and both get the same standard not-found page.
  const listing = await listingForActor(actor, id);
  if (!listing) notFound();

  const [tm, tw, te, tp, locale, neighborhoods, agency, locked, freeLaunch] = await Promise.all([
    getTranslations("myListing"),
    getTranslations("agency.workspace"),
    getTranslations("enums"),
    getTranslations("properties"),
    getLocale(),
    allNeighborhoods(),
    agencyById(actor.agencyId!),
    homeEditLocked(actor, listing.id),
    getFreeLaunch(),
  ]);

  // At the plan limit, "send for review again" is replaced by a plain message.
  let capMessage: string | null = null;
  if (agency) {
    const inPlay = await countListingsInPlay(agency.id);
    if (!canAddListing(agency.tier, inPlay, { freeLaunch })) capMessage = tw("atLimitResend");
  }

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
        actions={agencyPanelActions}
        listHref="/agency/listings"
        capMessage={capMessage}
      />
      <FeatureCallout
        listingId={listing.id}
        status={listing.status}
        agencyId={listing.agencyId}
        featuredUntil={listing.featuredUntil}
      />
      <Link
        href="/agency/enquiries"
        className="flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-teal-800 ring-1 ring-stone-300 hover:bg-stone-100 dark:text-teal-300 dark:ring-stone-700 dark:hover:bg-stone-800"
      >
        {tw("seeEnquiries")}
      </Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <DirectionalLink direction="back" href="/agency/listings" className="inline-flex min-h-11 items-center text-sm text-teal-800 hover:underline dark:text-teal-300">
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
          {locked ? (
            // This home is verified by our team (or shared by several listings), so
            // its details can't be rewritten here. Withdrawing or marking sold or
            // rented still works from the panel.
            <section id="listing-form" role="note" className="space-y-1 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-100">
              <h2 className="font-semibold">{tw("lockedTitle")}</h2>
              <p>{tw("lockedBody")}</p>
            </section>
          ) : (
            <>
              {live && (
                <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-100">
                  {tm("form.editNotice")}
                </p>
              )}
              <ListingForm
                audience="agency"
                mode="edit"
                neighborhoods={neighborhoods}
                actions={agencyFormActions}
                successHref="/agency/listings?submitted=1"
                editHrefBase="/agency/listings"
                draftKey={`agency:${listing.id}`}
                listingId={listing.id}
                status={listing.status}
                initialValues={initialValues}
                initialPhotos={p.images.map((i) => ({ id: i.id, path: i.storagePath, altEn: i.altEn, altAr: i.altAr }))}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
