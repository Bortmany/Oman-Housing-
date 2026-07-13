import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { agencyById, countListingsInPlay } from "@/lib/db/agencies";
import { listingAllowance } from "@/lib/tiers";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export default async function AgencyDashboardPage() {
  const [t, locale, session] = await Promise.all([
    getTranslations("agency"),
    getLocale(),
    auth(),
  ]);
  if (!session?.user.agencyId) return null; // layout guards role

  const agency = await agencyById(session.user.agencyId);
  if (!agency) return null;

  const inPlay = await countListingsInPlay(agency.id);
  const allowance = listingAllowance(agency.tier, inPlay);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900">
        {localName(locale, agency.nameEn, agency.nameAr)}
      </h1>
      <p className="mt-1 text-sm text-stone-500">{t("dashboard.subtitle")}</p>

      {/* Approval banner */}
      <div
        className={`mt-6 rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${
          agency.isApproved
            ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
            : "bg-amber-50 text-amber-900 ring-amber-600/20"
        }`}
      >
        {agency.isApproved ? t("dashboard.approved") : t("dashboard.pending")}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-medium text-stone-500">{t("dashboard.plan")}</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">
            {t(`tier.${agency.tier}`)}
          </p>
          <p className="mt-2 text-sm text-stone-600">
            {allowance.unlimited
              ? t("dashboard.allowanceUnlimited", { used: allowance.used })
              : t("dashboard.allowance", {
                  used: allowance.used,
                  limit: allowance.limit,
                  remaining: allowance.remaining,
                })}
          </p>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-sm font-medium text-stone-500">{t("dashboard.quickLinks")}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href="/agency/listings">{t("nav.listings")}</ButtonLink>
            <ButtonLink href="/agency/enquiries" variant="secondary">
              {t("nav.enquiries")}
            </ButtonLink>
            <ButtonLink href="/agency/profile" variant="secondary">
              {t("nav.profile")}
            </ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}
