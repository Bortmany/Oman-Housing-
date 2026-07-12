import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PropertyForm } from "../PropertyForm";
import { Link } from "@/i18n/navigation";

export default async function NewPropertyPage() {
  const [t, neighborhoods] = await Promise.all([
    getTranslations("admin"),
    prisma.neighborhood.findMany({
      orderBy: { nameEn: "asc" },
      include: { city: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/admin/properties"
        className="text-sm text-teal-800 hover:underline"
      >
        ‹ {t("properties")}
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-stone-900">
        {t("newProperty")}
      </h1>
      <div className="mt-6">
        <PropertyForm neighborhoods={neighborhoods} />
      </div>
    </div>
  );
}
