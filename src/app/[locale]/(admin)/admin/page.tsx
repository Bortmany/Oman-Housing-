import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { enforceAdminPage } from "@/lib/require-admin";
import { getFreeLaunch } from "@/lib/siteSettings";
import { countFlaggedEvents7d } from "@/lib/payments/core";
import { countLiveCampaigns } from "@/lib/ads/core";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default async function AdminHome() {
  await enforceAdminPage(); // guard BEFORE any DB query (see require-admin.ts)
  const [
    t,
    statCount,
    propCount,
    listingCount,
    pendingListings,
    unverifiedProps,
    unverifiedStats,
    agencyCount,
    pendingAgencies,
    newInquiries,
    freeLaunch,
    tSettings,
    tPay,
    tAds,
    flaggedPayments,
    liveAds,
  ] = await Promise.all([
    getTranslations("admin"),
    prisma.marketStat.count(),
    prisma.property.count(),
    prisma.listing.count(),
    prisma.listing.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.property.count({ where: { provenance: "USER_SUBMITTED", verifiedAt: null } }),
    prisma.marketStat.count({ where: { provenance: "USER_SUBMITTED", verifiedAt: null } }),
    prisma.agency.count(),
    prisma.agency.count({ where: { isApproved: false } }),
    prisma.inquiry.count({ where: { status: "NEW" } }),
    getFreeLaunch(),
    getTranslations("adminSettings"),
    getTranslations("adminPayments"),
    getTranslations("adminAds"),
    countFlaggedEvents7d(),
    countLiveCampaigns(),
  ]);

  const reviewCount = pendingListings + unverifiedProps + unverifiedStats;

  const sections: Array<{
    href: string;
    title: string;
    hint: string;
    count: number | string;
    badge?: boolean;
    note?: string | null;
  }> = [
    {
      href: "/admin/review",
      title: t("review.title"),
      hint: t("review.dashHint"),
      count: reviewCount,
      badge: reviewCount > 0,
    },
    {
      href: "/admin/inquiries",
      title: t("inquiries.title"),
      hint: t("inquiries.dashHint"),
      count: newInquiries,
      badge: newInquiries > 0,
    },
    {
      href: "/admin/agencies",
      title: t("agencies.title"),
      hint: t("agencies.dashHint"),
      count: agencyCount,
      badge: pendingAgencies > 0,
    },
    {
      href: "/admin/market-stats",
      title: t("marketStats"),
      hint: t("marketStatsHint"),
      count: statCount,
    },
    {
      href: "/admin/properties",
      title: t("properties"),
      hint: t("propertiesHint"),
      count: propCount,
    },
    {
      href: "/admin/listings",
      title: t("listings"),
      hint: t("listingsHint"),
      count: listingCount,
    },
    {
      href: "/admin/settings",
      title: tSettings("title"),
      hint: tSettings("dashHint"),
      // The card's big figure is the switch itself: On / Off.
      count: freeLaunch ? tSettings("freeLaunch.on") : tSettings("freeLaunch.off"),
    },
    {
      href: "/admin/payments",
      title: tPay("title"),
      hint: tPay("dashHint"),
      // Flagged payment events in the last 7 days (0 = all quiet).
      count: flaggedPayments,
      badge: flaggedPayments > 0,
      note: flaggedPayments > 0 ? tPay("flaggedBadge", { count: flaggedPayments }) : null,
    },
    {
      href: "/admin/ads",
      title: tAds("title"),
      hint: tAds("dashHint"),
      count: liveAds, // campaigns live right now
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{t("subtitle")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="transition-shadow group-hover:shadow-md">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold text-stone-900 group-hover:text-teal-800 dark:text-stone-100 dark:group-hover:text-teal-300">
                  {s.title}
                </h2>
                <span
                  className={`text-2xl font-bold ${
                    s.badge ? "text-amber-600 dark:text-amber-400" : "text-teal-800 dark:text-teal-300"
                  }`}
                >
                  {s.count}
                </span>
              </div>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{s.hint}</p>
              {s.note && (
                <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">{s.note}</p>
              )}
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-6">
        <Link
          href="/admin/settings/prices"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 hover:underline dark:text-teal-300"
        >
          {tPay("pricesLink")}
        </Link>
      </p>
    </div>
  );
}
