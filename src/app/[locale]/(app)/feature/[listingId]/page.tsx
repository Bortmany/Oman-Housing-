import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { listingForActor } from "@/lib/listings/core";
import { isFeaturedNow } from "@/lib/featured";
import { getPrivacyContactEmail } from "@/lib/legalContact";
import { formatDateTime, localName } from "@/lib/i18nData";
import { formatOMR } from "@/lib/money";
import { featureActor } from "@/lib/payments/service";
import { getFeaturedPrice } from "@/lib/payments/prices";
import { isThawaniEnabled } from "@/lib/payments/thawani";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DirectionalLink } from "@/components/ui/DirectionalLink";
import { PayButton } from "./PayButton";

export const metadata = { robots: { index: false, follow: false } };

export default async function FeatureListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  // Guard first: only the listing's own owner / agency. Someone else's listing,
  // a missing one, and a signed-in admin all get the same standard not-found.
  const actor = await featureActor();
  if (!actor) notFound();
  const { listingId } = await params;
  const listing = await listingForActor(actor, listingId);
  if (!listing) notFound();

  const [t, locale] = await Promise.all([getTranslations("featured"), getLocale()]);
  const p = listing.property;
  const title = localName(locale, p.titleEn, p.titleAr);
  const cover = p.images[0];
  const backHref = actor.agencyId ? `/agency/listings/${listing.id}` : `/account/listings/${listing.id}`;
  const live = listing.status === "ACTIVE" && !listing.isSample && !p.isSample;
  const enabled = isThawaniEnabled();
  const price = await getFeaturedPrice(listing.agencyId);
  const period = t("days", { count: price.days });
  const priceText = formatOMR(price.amount, locale);
  const activeUntil = isFeaturedNow(listing.featuredUntil, new Date()) ? listing.featuredUntil : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <DirectionalLink direction="back" href={backHref} className="inline-flex min-h-11 items-center text-sm text-teal-800 hover:underline dark:text-teal-300">
        {t("result.back")}
      </DirectionalLink>
      <h1 className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-100">{t("checkout.title")}</h1>

      <Card className="mt-4 flex items-center gap-3">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/images/${cover.storagePath}`} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="size-16 shrink-0 rounded-lg bg-stone-100 dark:bg-stone-800" />
        )}
        <p className="min-w-0 text-sm font-medium text-stone-900 dark:text-stone-100">
          {t("checkout.forListing", { title })}
        </p>
      </Card>

      {!live ? (
        <Card className="mt-4 space-y-3">
          <p role="note" className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-100">
            {t("checkout.notLive")}
          </p>
          <ButtonLink href={backHref} variant="secondary" className="w-full">{t("result.back")}</ButtonLink>
        </Card>
      ) : (
        <Card className="mt-4 space-y-4">
          <p className="text-sm text-stone-700 dark:text-stone-300">{t("checkout.lede", { period })}</p>
          <ul className="list-disc space-y-1 ps-5 text-sm text-stone-700 dark:text-stone-300">
            <li>{t("checkout.bullet1")}</li>
            <li>{t("checkout.bullet2")}</li>
            <li>{t("checkout.bullet3")}</li>
          </ul>
          {activeUntil && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-100">
              {t("checkout.alreadyFeatured", { date: formatDateTime(locale, activeUntil), period })}
            </p>
          )}
          <div className="flex items-baseline justify-between gap-3 border-t border-stone-200 pt-3 dark:border-stone-800">
            <span className="text-sm text-stone-600 dark:text-stone-300">{t("checkout.total")}</span>
            <span dir="ltr" className="text-xl font-bold text-teal-800 dark:text-teal-300">{priceText}</span>
          </div>
          {enabled ? (
            <PayButton
              listingId={listing.id}
              label={t("checkout.pay", { price: priceText })}
              workingLabel={t("checkout.working")}
              note={t("checkout.redirectNote")}
              errors={{
                rateLimited: t("errors.rateLimited"),
                startFailed: t("errors.startFailed"),
                wrongState: t("errors.wrongState"),
              }}
            />
          ) : (
            <div className="space-y-2 text-sm text-stone-700 dark:text-stone-300">
              <p role="note" className="rounded-lg bg-sky-50 px-3 py-2 text-sky-900 ring-1 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-100">
                {t("checkout.notSwitchedOn")}
              </p>
              <p>{t("checkout.contact", { email: getPrivacyContactEmail() })}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
