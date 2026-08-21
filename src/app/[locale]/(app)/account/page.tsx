import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { inquiriesForUser } from "@/lib/db/inquiries";
import { savedSearchesForUser } from "@/lib/db/saved-searches";
import { searchQueryToObject } from "@/lib/savedSearch";
import { deleteSavedSearchAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { InquiryStatusPill } from "@/components/marketplace/InquiryStatusPill";
import { Link } from "@/i18n/navigation";

export default async function AccountPage() {
  const [t, te, ts, locale, session] = await Promise.all([
    getTranslations("account"),
    getTranslations("enquiry"),
    getTranslations("savedSearches"),
    getLocale(),
    auth(),
  ]);
  if (!session) return null; // layout already redirects

  const [enquiries, savedSearches] = await Promise.all([
    inquiriesForUser(session.user.id),
    savedSearchesForUser(session.user.id),
  ]);
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM", {
    dateStyle: "medium",
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
        {t("title")}
      </h1>
      <Card className="mt-6 space-y-3 text-sm">
        <p>
          <span className="font-medium text-stone-500 dark:text-stone-400">{t("signedInAs")}:</span>{" "}
          {session.user.name ?? session.user.email}
        </p>
        <p>
          <span className="font-medium text-stone-500 dark:text-stone-400">{t("role")}:</span>{" "}
          {session.user.role}
        </p>
        <p>
          <span className="font-medium text-stone-500 dark:text-stone-400">{t("tier")}:</span>{" "}
          {session.user.tier}
        </p>
      </Card>

      <h2 className="mt-10 text-lg font-semibold text-stone-900 dark:text-stone-100">
        {ts("title")}
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {ts("emailNotLive")}
      </p>
      {savedSearches.length === 0 ? (
        <Card className="mt-3 text-sm text-stone-500 dark:text-stone-400">
          {ts("empty")}
        </Card>
      ) : (
        <ul className="mt-3 space-y-3">
          {savedSearches.map((search) => (
            <li key={search.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link
                    href={{
                      pathname: "/properties",
                      query: searchQueryToObject(search.query),
                    }}
                    className="font-medium text-stone-900 hover:text-teal-800 dark:text-stone-100 dark:hover:text-teal-300"
                  >
                    {search.name}
                  </Link>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {ts("frequencyLabel")}: {ts(`frequency.${search.frequency}`)}
                  </p>
                </div>
                <form action={deleteSavedSearchAction}>
                  <input type="hidden" name="id" value={search.id} />
                  <input type="hidden" name="redirectTo" value="/account" />
                  <Button type="submit" variant="secondary">
                    {ts("delete")}
                  </Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold text-stone-900 dark:text-stone-100">
        {te("myEnquiries")}
      </h2>
      {enquiries.length === 0 ? (
        <Card className="mt-3 text-sm text-stone-500 dark:text-stone-400">
          {te("myEnquiriesEmpty")}
        </Card>
      ) : (
        <ul className="mt-3 space-y-3">
          {enquiries.map((q) => (
            <li key={q.id}>
              <Card className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/properties/${q.listing.propertyId}`}
                    className="font-medium text-stone-900 hover:text-teal-800 dark:text-stone-100 dark:hover:text-teal-300"
                  >
                    {localName(
                      locale,
                      q.listing.property.titleEn,
                      q.listing.property.titleAr,
                    )}
                  </Link>
                  <InquiryStatusPill status={q.status} />
                </div>
                <p className="whitespace-pre-line text-sm text-stone-600 dark:text-stone-300">
                  {q.message}
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  {dateFmt.format(q.createdAt)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
