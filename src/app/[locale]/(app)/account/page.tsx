import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { inquiriesForUser } from "@/lib/db/inquiries";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { InquiryStatusPill } from "@/components/marketplace/InquiryStatusPill";
import { Link } from "@/i18n/navigation";

export default async function AccountPage() {
  const [t, te, locale, session] = await Promise.all([
    getTranslations("account"),
    getTranslations("enquiry"),
    getLocale(),
    auth(),
  ]);
  if (!session) return null; // layout already redirects

  const enquiries = await inquiriesForUser(session.user.id);
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM", {
    dateStyle: "medium",
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-stone-900">{t("title")}</h1>
      <Card className="mt-6 space-y-3 text-sm">
        <p>
          <span className="font-medium text-stone-500">{t("signedInAs")}:</span>{" "}
          {session.user.name ?? session.user.email}
        </p>
        <p>
          <span className="font-medium text-stone-500">{t("role")}:</span>{" "}
          {session.user.role}
        </p>
        <p>
          <span className="font-medium text-stone-500">{t("tier")}:</span>{" "}
          {session.user.tier}
        </p>
      </Card>

      <h2 className="mt-10 text-lg font-semibold text-stone-900">
        {te("myEnquiries")}
      </h2>
      {enquiries.length === 0 ? (
        <Card className="mt-3 text-sm text-stone-500">{te("myEnquiriesEmpty")}</Card>
      ) : (
        <ul className="mt-3 space-y-3">
          {enquiries.map((q) => (
            <li key={q.id}>
              <Card className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/properties/${q.listing.propertyId}`}
                    className="font-medium text-stone-900 hover:text-teal-800"
                  >
                    {localName(
                      locale,
                      q.listing.property.titleEn,
                      q.listing.property.titleAr,
                    )}
                  </Link>
                  <InquiryStatusPill status={q.status} />
                </div>
                <p className="whitespace-pre-line text-sm text-stone-600">
                  {q.message}
                </p>
                <p className="text-xs text-stone-400">
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
