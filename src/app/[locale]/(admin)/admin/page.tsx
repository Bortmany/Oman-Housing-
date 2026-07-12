import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default async function AdminHome() {
  const [t, statCount, propCount, listingCount] = await Promise.all([
    getTranslations("admin"),
    prisma.marketStat.count(),
    prisma.property.count(),
    prisma.listing.count(),
  ]);

  const sections = [
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
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-900">{t("title")}</h1>
      <p className="mt-2 text-sm text-stone-600">{t("subtitle")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="transition-shadow group-hover:shadow-md">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold text-stone-900 group-hover:text-teal-800">
                  {s.title}
                </h2>
                <span className="text-2xl font-bold text-teal-800">
                  {s.count}
                </span>
              </div>
              <p className="mt-2 text-sm text-stone-600">{s.hint}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
