import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { agencyById, agencyListings, countListingsInPlay } from "@/lib/db/agencies";
import { listingAllowance } from "@/lib/tiers";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName } from "@/lib/i18nData";
import { StatusPill } from "@/components/marketplace/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default async function AgencyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [{ submitted }, t, tp, te, locale, session] = await Promise.all([
    searchParams,
    getTranslations("agency"),
    getTranslations("properties"),
    getTranslations("enums"),
    getLocale(),
    auth(),
  ]);
  if (!session?.user.agencyId) return null;

  const agency = await agencyById(session.user.agencyId);
  if (!agency) return null;

  const [listings, inPlay] = await Promise.all([
    agencyListings(agency.id),
    countListingsInPlay(agency.id),
  ]);
  const allowance = listingAllowance(agency.tier, inPlay);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900">{t("nav.listings")}</h1>
        {allowance.canAdd ? (
          <ButtonLink href="/agency/listings/new">{t("listings.newListing")}</ButtonLink>
        ) : (
          <span className="rounded-lg bg-stone-100 px-4 py-2 text-sm text-stone-500">
            {t("listings.atLimit")}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-stone-500">
        {allowance.unlimited
          ? t("dashboard.allowanceUnlimited", { used: allowance.used })
          : t("dashboard.allowance", {
              used: allowance.used,
              limit: allowance.limit,
              remaining: allowance.remaining,
            })}
      </p>

      {submitted && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
          {t("listings.submittedNotice")}
        </p>
      )}

      {listings.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="font-medium text-stone-700">{t("listings.empty")}</p>
          <p className="mt-1 text-sm text-stone-500">{t("listings.emptyHint")}</p>
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs text-stone-500">
                <th className="px-4 py-3 text-start font-medium">{tp("filterType")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("listings.property")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("listings.price")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("listings.status")}</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 text-stone-600">
                    {l.listingType === "SALE" ? t("listings.sale") : t("listings.rent")}
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {localName(locale, l.property.titleEn, l.property.titleAr)}
                  </td>
                  <td className="px-4 py-3">
                    {formatOMRWhole(decimalToNumber(l.price)!, locale)}
                    {l.rentPeriod && (
                      <span className="ms-1 text-xs text-stone-500">
                        {te(`rentPeriod.${l.rentPeriod}`)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
