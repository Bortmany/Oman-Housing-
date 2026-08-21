import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { saveSearchAction } from "@/app/[locale]/(app)/account/actions";
import { Button } from "@/components/ui/Button";
import { FREQUENCIES, DEFAULT_FREQUENCY } from "@/lib/savedSearch";

// "Save this search" — a plain server-action form when signed in, a link to
// sign in when signed out (zero client JavaScript, same as the favorite
// button). The note underneath is honest about email alerts not being live.
export function SaveSearchButton({
  query,
  signedIn,
  alreadySaved,
  redirectTo,
}: {
  /** The current search's query string, e.g. "hood=al-mouj&type=VILLA". */
  query: string;
  signedIn: boolean;
  alreadySaved: boolean;
  redirectTo: string;
}) {
  const t = useTranslations("savedSearches");

  if (!signedIn) {
    return (
      <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
        <Link
          href={{ pathname: "/login", query: { callbackUrl: redirectTo } }}
          className="font-semibold text-teal-800 hover:underline dark:text-teal-300"
        >
          {t("signInToSave")}
        </Link>
      </p>
    );
  }

  if (alreadySaved) {
    return (
      <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
        {t("alreadySaved")}{" "}
        <Link
          href="/account"
          className="font-semibold text-teal-800 hover:underline dark:text-teal-300"
        >
          {t("manageLink")}
        </Link>
      </p>
    );
  }

  return (
    <form action={saveSearchAction} className="mt-4">
      <input type="hidden" name="query" value={query} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="secondary">
          {t("saveThisSearch")}
        </Button>
        <label
          htmlFor="saved-search-frequency"
          className="text-sm text-stone-600 dark:text-stone-300"
        >
          {t("frequencyLabel")}
        </label>
        <select
          id="saved-search-frequency"
          name="frequency"
          defaultValue={DEFAULT_FREQUENCY}
          className="min-h-11 rounded-lg border-0 bg-white px-3 py-2 text-sm text-stone-900 ring-1 ring-inset ring-stone-300 focus:ring-2 focus:ring-inset focus:ring-teal-700 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700 dark:focus:ring-teal-400"
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {t(`frequency.${f}`)}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        {t("emailNotLive")}
      </p>
    </form>
  );
}
