import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { agencyById, countListingsInPlay } from "@/lib/db/agencies";
import { enforceAgencyPage } from "@/lib/listings/agencyGuard";
import { canAddListing } from "@/lib/tiers";
import { getFreeLaunch } from "@/lib/siteSettings";
import { allNeighborhoods } from "@/lib/db/market-stats";
import { DirectionalLink } from "@/components/ui/DirectionalLink";
import { ListingForm } from "@/components/listing-form/ListingForm";
import { agencyFormActions } from "../formActions";

export default async function NewAgencyListingPage() {
  const actor = await enforceAgencyPage(); // guard BEFORE any query
  const [t, tm, locale] = await Promise.all([
    getTranslations("agency"),
    getTranslations("myListing"),
    getLocale(),
  ]);

  const agency = await agencyById(actor.agencyId!);
  if (!agency) return null;

  // At the plan cap — bounce back to the list, which explains why.
  const [inPlay, freeLaunch] = await Promise.all([
    countListingsInPlay(agency.id),
    getFreeLaunch(),
  ]);
  if (!canAddListing(agency.tier, inPlay, { freeLaunch })) {
    redirect({ href: "/agency/listings", locale });
  }

  const neighborhoods = await allNeighborhoods();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <DirectionalLink direction="back" href="/agency/listings" className="inline-flex min-h-11 items-center text-sm text-teal-800 hover:underline dark:text-teal-300">
        {tm("back")}
      </DirectionalLink>
      <h1 className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">{t("listings.newListing")}</h1>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t("listings.newLede")}</p>
      <div className="mt-6">
        <ListingForm
          audience="agency"
          mode="create"
          neighborhoods={neighborhoods}
          actions={agencyFormActions}
          successHref="/agency/listings?submitted=1"
          editHrefBase="/agency/listings"
          draftKey="agency:new"
        />
      </div>
    </div>
  );
}
