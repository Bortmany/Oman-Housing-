import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { toggleFavoriteAction } from "@/app/[locale]/(app)/favorites/actions";

// Zero-JS favorite toggle: a plain server-action form when signed in, a link
// to login (with a callback back here) when signed out.
export function FavoriteButton({
  listingId,
  favorited,
  signedIn,
  redirectTo,
}: {
  listingId: string;
  favorited: boolean;
  signedIn: boolean;
  redirectTo: string;
}) {
  const t = useTranslations("favorites");

  const cls =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm ring-1 ring-inset transition-colors " +
    (favorited
      ? "bg-rose-50 text-rose-700 ring-rose-600/30 hover:bg-rose-100"
      : "bg-white text-stone-500 ring-stone-300 hover:bg-stone-100");

  if (!signedIn) {
    return (
      <Link
        href={{ pathname: "/login", query: { callbackUrl: redirectTo } }}
        className={cls}
        title={t("signInToSave")}
      >
        ♡
      </Link>
    );
  }

  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button
        type="submit"
        className={cls}
        title={favorited ? t("remove") : t("add")}
      >
        {favorited ? "♥" : "♡"}
      </button>
    </form>
  );
}
