import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { favoritesForUser } from "@/lib/db/favorites";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export async function generateMetadata() {
  const t = await getTranslations("favorites");
  return { title: t("title") };
}

export default async function FavoritesPage() {
  const [t, tp, session] = await Promise.all([
    getTranslations("favorites"),
    getTranslations("properties"),
    auth(),
  ]);
  if (!session) return null; // layout redirects

  const favorites = await favoritesForUser(session.user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-900">{t("title")}</h1>

      {favorites.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="font-medium text-stone-700">{t("empty")}</p>
          <p className="mt-1 text-sm text-stone-500">{t("emptyHint")}</p>
          <div className="mt-4">
            <ButtonLink href="/properties">{tp("backToSearch")}</ButtonLink>
          </div>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((f) => (
            <ListingCard
              key={f.id}
              listing={f.listing}
              favorited
              signedIn
              redirectTo="/favorites"
            />
          ))}
        </div>
      )}
    </div>
  );
}
