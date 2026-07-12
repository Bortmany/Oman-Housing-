import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { MarketStatForm } from "../MarketStatForm";
import { Link } from "@/i18n/navigation";

export default async function NewMarketStatPage() {
  const [t, governorates, cities, neighborhoods] = await Promise.all([
    getTranslations("admin"),
    prisma.governorate.findMany({ orderBy: { nameEn: "asc" } }),
    prisma.city.findMany({ orderBy: { nameEn: "asc" } }),
    prisma.neighborhood.findMany({ orderBy: { nameEn: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/admin/market-stats"
        className="text-sm text-teal-800 hover:underline"
      >
        ‹ {t("marketStats")}
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-stone-900">{t("newStat")}</h1>
      <div className="mt-6">
        <MarketStatForm
          locations={{
            governorates,
            cities,
            neighborhoods,
          }}
        />
      </div>
    </div>
  );
}
