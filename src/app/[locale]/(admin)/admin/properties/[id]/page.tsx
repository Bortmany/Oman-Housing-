import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { decimalToString } from "@/lib/money";
import { PropertyForm } from "../PropertyForm";
import { deleteProperty, deletePropertyImage, makePrimaryImage } from "../actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/marketplace/StatusPill";
import { Link } from "@/i18n/navigation";
import { DirectionalLink } from "@/components/ui/DirectionalLink";

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [t, tc, property, neighborhoods] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    prisma.property.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        listings: { orderBy: { updatedAt: "desc" } },
      },
    }),
    prisma.neighborhood.findMany({
      orderBy: { nameEn: "asc" },
      include: { city: true },
    }),
  ]);
  if (!property) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <DirectionalLink
        direction="back"
        href="/admin/properties"
        className="text-sm text-teal-800 hover:underline"
      >
        {t("properties")}
      </DirectionalLink>
      <div className="mt-3 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900">
          {t("editProperty")}
        </h1>
        <form action={deleteProperty}>
          <input type="hidden" name="id" value={property.id} />
          <Button variant="danger" type="submit">
            {tc("delete")}
          </Button>
        </form>
      </div>

      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
          {t("saved")}
        </p>
      )}

      <Card className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-stone-900">
            {t("forProperty")}
          </h2>
          <Link
            href={{ pathname: "/admin/listings/new", query: { propertyId: property.id } }}
            className="text-sm font-semibold text-teal-800 hover:underline"
          >
            {t("createListingFor")}
          </Link>
        </div>
        {property.listings.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {property.listings.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/admin/listings/${l.id}`}
                  className="text-teal-800 hover:underline"
                >
                  {l.listingType} · <StatusPill status={l.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {property.images.length > 0 && (
        <Card className="mt-6">
          <h2 className="text-sm font-semibold text-stone-900">
            {t("property.images")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {property.images.map((img) => (
              <div key={img.id} className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/images/${img.storagePath}`}
                  alt={img.altEn ?? property.titleEn}
                  className={`h-28 w-full rounded-lg object-cover ${
                    img.isPrimary ? "ring-2 ring-teal-700" : "ring-1 ring-stone-200"
                  }`}
                />
                <div className="flex items-center justify-between text-xs">
                  {img.isPrimary ? (
                    <span className="font-medium text-teal-800">
                      {t("property.primary")}
                    </span>
                  ) : (
                    <form action={makePrimaryImage}>
                      <input type="hidden" name="imageId" value={img.id} />
                      <button className="text-stone-500 hover:text-teal-800">
                        {t("property.makePrimary")}
                      </button>
                    </form>
                  )}
                  <form action={deletePropertyImage}>
                    <input type="hidden" name="imageId" value={img.id} />
                    <button className="text-rose-700 hover:underline">✕</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6">
        <PropertyForm
          neighborhoods={neighborhoods}
          defaults={{
            id: property.id,
            neighborhoodId: property.neighborhoodId,
            type: property.type,
            ownership: property.ownership,
            titleEn: property.titleEn,
            titleAr: property.titleAr,
            descriptionEn: property.descriptionEn,
            descriptionAr: property.descriptionAr,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            areaSqm: decimalToString(property.areaSqm),
            plotSqm: decimalToString(property.plotSqm),
            yearBuilt: property.yearBuilt,
            furnished: property.furnished,
            lat: property.lat,
            lng: property.lng,
            provenance: property.provenance,
            confidence: property.confidence,
            sourceNote: property.sourceNote,
          }}
        />
      </div>
    </div>
  );
}
