import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { enforceOwnerPage, ownerPhoneRow } from "@/lib/listings/ownerGuard";
import { ownerHasSlot } from "@/lib/listings/rules";
import { slotsUsed } from "@/lib/listings/core";
import { isPhoneVerified, verifiedPhoneOf } from "@/lib/phoneVerify";
import { allNeighborhoods } from "@/lib/db/market-stats";
import { DirectionalLink } from "@/components/ui/DirectionalLink";
import { ListingForm } from "@/components/listing-form/ListingForm";
import { ownerFormActions } from "../formActions";

export async function generateMetadata() {
  const t = await getTranslations("owner");
  return { title: t("newListing") };
}

export default async function NewOwnerListingPage() {
  const actor = await enforceOwnerPage(); // guard BEFORE any query
  const [t, tm, locale, phoneRow] = await Promise.all([
    getTranslations("owner"),
    getTranslations("myListing"),
    getLocale(),
    ownerPhoneRow(actor.userId),
  ]);

  // Unverified phone: go and verify first. At the cap: back to the list, which says why.
  if (!isPhoneVerified(phoneRow)) {
    redirect({ href: "/account/listings/verify-phone", locale });
  }
  if (!ownerHasSlot(await slotsUsed(actor))) {
    redirect({ href: "/account/listings", locale });
  }

  const neighborhoods = await allNeighborhoods();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <DirectionalLink direction="back" href="/account/listings" className="inline-flex min-h-11 items-center text-sm text-teal-800 hover:underline dark:text-teal-300">
        {tm("back")}
      </DirectionalLink>
      <h1 className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">{t("newListing")}</h1>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t("newLede")}</p>
      <div className="mt-6">
        <ListingForm
          audience="owner"
          mode="create"
          neighborhoods={neighborhoods}
          actions={ownerFormActions}
          successHref="/account/listings?submitted=1"
          editHrefBase="/account/listings"
          draftKey="owner:new"
          ownerPhone={verifiedPhoneOf(phoneRow) ?? ""}
        />
      </div>
    </div>
  );
}
