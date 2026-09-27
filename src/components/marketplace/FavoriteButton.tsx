import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Tooltip } from "@/components/ui/Tooltip";
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

  // The pill stays visually small, but the invisible ::after box stretches the
  // tappable area to roughly 44px tall — the minimum comfortable touch target.
  // The sideways stretch stays at 4px so it can't swallow taps meant for the
  // provenance badge sitting right beside it.
  const cls =
    "relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm ring-1 ring-inset transition-colors after:absolute after:-inset-y-2 after:-inset-x-1 after:content-[''] " +
    (favorited
      ? "bg-rose-50 text-rose-700 ring-rose-600/30 hover:bg-rose-100"
      : "bg-white text-stone-500 ring-stone-300 hover:bg-stone-100");

  if (!signedIn) {
    return (
      <Tooltip label={t("signInToSave")}>
        <Link
          href={{ pathname: "/login", query: { callbackUrl: redirectTo } }}
          className={cls}
          aria-label={t("signInToSave")}
        >
          ♡
        </Link>
      </Tooltip>
    );
  }

  // The label tells you what pressing the heart will do, and doubles as the
  // screen-reader name for the button (saved vs. not saved).
  const actionLabel = favorited ? t("remove") : t("add");

  return (
    <Tooltip label={actionLabel}>
      <form action={toggleFavoriteAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <button type="submit" className={cls} aria-label={actionLabel}>
          {favorited ? "♥" : "♡"}
        </button>
      </form>
    </Tooltip>
  );
}
