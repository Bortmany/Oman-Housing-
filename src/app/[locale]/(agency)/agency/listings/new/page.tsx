import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { agencyById, countListingsInPlay } from "@/lib/db/agencies";
import { canAddListing } from "@/lib/tiers";
import { allNeighborhoods } from "@/lib/db/market-stats";
import { AgencyListingForm } from "../AgencyListingForm";

export default async function NewAgencyListingPage() {
  const [t, locale, session] = await Promise.all([
    getTranslations("agency"),
    getLocale(),
    auth(),
  ]);
  if (!session?.user.agencyId) return null;

  const agency = await agencyById(session.user.agencyId);
  if (!agency) return null;

  // At the plan cap — bounce back to the list, which explains why.
  const inPlay = await countListingsInPlay(agency.id);
  if (!canAddListing(agency.tier, inPlay)) {
    redirect({ href: "/agency/listings", locale });
  }

  const neighborhoods = await allNeighborhoods();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900">{t("listings.newListing")}</h1>
      <p className="mt-1 text-sm text-stone-500">{t("listings.newLede")}</p>
      <div className="mt-6">
        <AgencyListingForm neighborhoods={neighborhoods} />
      </div>
    </div>
  );
}
