import { getLocale, getTranslations } from "next-intl/server";
import { agencyById, agencyListings, countListingsInPlay } from "@/lib/db/agencies";
import { enforceAgencyPage } from "@/lib/listings/agencyGuard";
import { listingAllowance } from "@/lib/tiers";
import { getFreeLaunch } from "@/lib/siteSettings";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName } from "@/lib/i18nData";
import { Link } from "@/i18n/navigation";
import { OwnStatusPill } from "@/components/listing-form/OwnStatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-stone-400 rtl:rotate-180">
      <path d="M7.5 4.5 13 10l-5.5 5.5" />
    </svg>
  );
}

export default async function AgencyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const actor = await enforceAgencyPage(); // guard BEFORE any query
  const [{ submitted }, t, tf, tw, tp, te, locale] = await Promise.all([
    searchParams,
    getTranslations("agency"),
    getTranslations("freeLaunch"),
    getTranslations("agency.workspace"),
    getTranslations("properties"),
    getTranslations("enums"),
    getLocale(),
  ]);

  const agency = await agencyById(actor.agencyId!);
  if (!agency) return null;

  const [listings, inPlay, freeLaunch] = await Promise.all([
    agencyListings(agency.id),
    countListingsInPlay(agency.id),
    getFreeLaunch(),
  ]);
  const allowance = listingAllowance(agency.tier, inPlay, { freeLaunch });

  const price = (l: (typeof listings)[number]) => (
    <>
      {formatOMRWhole(decimalToNumber(l.price)!, locale)}
      {l.rentPeriod && (
        <span className="text-xs font-normal text-stone-500 dark:text-stone-400">
          {" "}{te(`rentPeriod.${l.rentPeriod}`)}
        </span>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("nav.listings")}</h1>
        {allowance.canAdd ? (
          <ButtonLink href="/agency/listings/new" className="w-full sm:w-auto">{t("listings.newListing")}</ButtonLink>
        ) : (
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <Tooltip label={tw("limitTip")} side="bottom">
            <span
              tabIndex={0}
              className="rounded-lg bg-stone-100 px-4 py-2 text-sm text-stone-500 dark:bg-stone-800 dark:text-stone-400"
            >
              {t("listings.atLimit")}
            </span>
            </Tooltip>
            <Link href="/list-with-us" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 underline underline-offset-2 dark:text-teal-300">
              {tw("upgrade")}
            </Link>
          </div>
        )}
      </div>

      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
        {freeLaunch
          ? tf("allowance", { count: allowance.used })
          : allowance.unlimited
          ? t("dashboard.allowanceUnlimited", { used: allowance.used })
          : allowance.used > allowance.limit
          ? t("dashboard.allowanceOver", { used: allowance.used, limit: allowance.limit })
          : t("dashboard.allowance", {
              used: allowance.used,
              limit: allowance.limit,
              remaining: allowance.remaining,
            })}
      </p>

      {submitted && (
        <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/30">
          {t("listings.submittedNotice")}
        </p>
      )}

      {listings.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="font-medium text-stone-700 dark:text-stone-300">{tw("emptyWarm")}</p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t("listings.emptyHint")}</p>
        </Card>
      ) : (
        <>
          {/* Phone: stacked cards, no table, no sideways scroll. Each card is one big link. */}
          <ul className="mt-6 space-y-3 sm:hidden">
            {listings.map((l) => {
              const title = localName(locale, l.property.titleEn, l.property.titleAr);
              return (
                <li key={l.id}>
                  <Link
                    href={`/agency/listings/${l.id}`}
                    className="block min-h-22 space-y-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 active:bg-stone-50 dark:bg-stone-900 dark:ring-stone-800 dark:active:bg-stone-800"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="line-clamp-2 min-w-0 font-medium text-stone-900 dark:text-stone-100">{title}</span>
                      <Chevron />
                    </span>
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-lg font-bold text-teal-800 dark:text-teal-300">{price(l)}</span>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                        {l.listingType === "SALE" ? t("listings.sale") : t("listings.rent")}
                      </span>
                    </span>
                    <span className="block">
                      <OwnStatusPill status={l.status} publishedBefore={l.publishedAt != null} />
                    </span>
                    <span className="block text-xs text-stone-500 dark:text-stone-400">
                      {te(`propertyType.${l.property.type}`)}
                    </span>
                    {l.status === "REJECTED" && (
                      <span className="block text-xs font-medium text-rose-700 dark:text-rose-300">{tw("openToSee")}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* 640 px and up: the table, each row opens its listing. */}
          <div className="mt-6 hidden overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200 sm:block dark:bg-stone-900 dark:ring-stone-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
                  <th className="px-4 py-3 text-start font-medium">{t("listings.property")}</th>
                  <th className="px-4 py-3 text-start font-medium">{tp("filterType")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("listings.price")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("listings.status")}</th>
                  <th className="w-10 px-4 py-3"><span className="sr-only">{tw("opens")}</span></th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => {
                  const title = localName(locale, l.property.titleEn, l.property.titleAr);
                  const cover = l.property.images[0];
                  return (
                    <tr key={l.id} className="relative border-b border-stone-100 last:border-0 hover:bg-stone-50 active:bg-stone-100 dark:border-stone-800 dark:hover:bg-stone-800/60 dark:active:bg-stone-800">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/api/images/${cover.storagePath}`} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <div className="size-12 shrink-0 rounded-lg bg-stone-100 dark:bg-stone-800" aria-hidden="true" />
                          )}
                          {/* The whole row is the click target (the link stretches over it). */}
                          <Link
                            href={`/agency/listings/${l.id}`}
                            className="font-medium text-stone-900 after:absolute after:inset-0 after:content-[''] hover:text-teal-800 hover:underline dark:text-stone-100 dark:hover:text-teal-300"
                          >
                            {title}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-600 dark:text-stone-300">
                        {l.listingType === "SALE" ? t("listings.sale") : t("listings.rent")}
                      </td>
                      <td className="px-4 py-3">{price(l)}</td>
                      <td className="px-4 py-3"><OwnStatusPill status={l.status} publishedBefore={l.publishedAt != null} /></td>
                      <td className="px-4 py-3"><Chevron /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
