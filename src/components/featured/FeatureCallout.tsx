import { getLocale, getTranslations } from "next-intl/server";
import { isFeaturedNow } from "@/lib/featured";
import { getPrivacyContactEmail } from "@/lib/legalContact";
import { formatDateTime } from "@/lib/i18nData";
import { formatOMR } from "@/lib/money";
import { getFeaturedPrice } from "@/lib/payments/prices";
import { isThawaniEnabled } from "@/lib/payments/thawani";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * "Feature this listing — OMR 3.000 for 30 days" on the owner's and agency's
 * own listing pages. Live listings only; the page has already checked the
 * viewer owns the listing. With no gateway keys it says online payments are
 * not switched on and gives the contact address (no button, nothing created).
 * Price in three decimals (formatOMR, never the whole-rial format).
 */
export async function FeatureCallout({
  listingId,
  status,
  agencyId,
  featuredUntil,
}: {
  listingId: string;
  status: string;
  agencyId: string | null;
  featuredUntil: Date | null;
}) {
  if (status !== "ACTIVE") return null;

  const [t, locale] = await Promise.all([getTranslations("featured"), getLocale()]);
  const price = await getFeaturedPrice(agencyId);
  const activeUntil = isFeaturedNow(featuredUntil, new Date()) ? featuredUntil : null;

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{t("checkout.title")}</h2>
      {activeUntil && (
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          {t("callout.activeUntil", { date: formatDateTime(locale, activeUntil) })}
        </p>
      )}
      {isThawaniEnabled() ? (
        <FeatureButton listingId={listingId} agencyId={agencyId} locale={locale} />
      ) : (
        <div className="space-y-2 text-sm text-stone-700 dark:text-stone-300">
          <p className="font-semibold text-stone-900 dark:text-stone-100">
            {t("callout.button", {
              price: formatOMR(price.amount, locale),
              period: t("days", { count: price.days }),
            })}
          </p>
          <p role="note" className="rounded-lg bg-sky-50 px-3 py-2 text-sky-900 ring-1 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-100">
            {t("checkout.notSwitchedOn")}
          </p>
          <p>
            {t("checkout.contact", { email: getPrivacyContactEmail() })}
          </p>
        </div>
      )}
    </Card>
  );
}

async function FeatureButton({
  listingId,
  agencyId,
  locale,
}: {
  listingId: string;
  agencyId: string | null;
  locale: string;
}) {
  const t = await getTranslations("featured");
  const price = await getFeaturedPrice(agencyId);
  return (
    <ButtonLink href={`/feature/${listingId}`} className="w-full text-center">
      {t("callout.button", {
        price: formatOMR(price.amount, locale),
        period: t("days", { count: price.days }),
      })}
    </ButtonLink>
  );
}
