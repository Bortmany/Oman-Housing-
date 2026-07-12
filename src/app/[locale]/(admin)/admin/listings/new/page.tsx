import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ListingForm } from "../ListingForm";
import { Link } from "@/i18n/navigation";

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const [t, properties] = await Promise.all([
    getTranslations("admin"),
    prisma.property.findMany({
      orderBy: { titleEn: "asc" },
      select: { id: true, titleEn: true, titleAr: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/admin/listings" className="text-sm text-teal-800 hover:underline">
        ‹ {t("listings")}
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-stone-900">{t("newListing")}</h1>
      <div className="mt-6">
        <ListingForm properties={properties} defaults={{ propertyId }} />
      </div>
    </div>
  );
}
