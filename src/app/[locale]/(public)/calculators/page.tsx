import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("calculators");
  return { title: t("title") };
}

export default async function CalculatorsPage() {
  const t = await getTranslations("calculators");

  const calcs = [
    { href: "/calculators/rental-yield", title: t("rentalYield.title"), body: t("rentalYield.description") },
    { href: "/calculators/mortgage", title: t("mortgage.title"), body: t("mortgage.description") },
    { href: "/calculators/roi", title: t("roi.title"), body: t("roi.description") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-900">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-stone-600">{t("subtitle")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {calcs.map((c) => (
          <Link key={c.href} href={c.href} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <h2 className="font-semibold text-stone-900 group-hover:text-teal-800">
                {c.title}
              </h2>
              <p className="mt-2 text-sm text-stone-600">{c.body}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
