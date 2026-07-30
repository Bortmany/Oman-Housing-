import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { inquiriesForAgency } from "@/lib/db/inquiries";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { InquiryStatusPill } from "@/components/marketplace/InquiryStatusPill";
import { setEnquiryStatusAgency } from "../actions";

export default async function AgencyEnquiriesPage() {
  const [t, locale, session] = await Promise.all([
    getTranslations("agency"),
    getLocale(),
    auth(),
  ]);
  if (!session?.user.agencyId) return null;

  const enquiries = await inquiriesForAgency(session.user.agencyId);
  const dateFmt = new Intl.DateTimeFormat(
    locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM",
    { dateStyle: "medium" },
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900">{t("nav.enquiries")}</h1>
      <p className="mt-1 text-sm text-stone-500">{t("enquiries.subtitle")}</p>

      {enquiries.length === 0 ? (
        <Card className="mt-6 text-center text-sm text-stone-500">
          {t("enquiries.empty")}
        </Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {enquiries.map((q) => (
            <li key={q.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-stone-900">
                    {localName(locale, q.listing.property.titleEn, q.listing.property.titleAr)}
                  </span>
                  <InquiryStatusPill status={q.status} />
                </div>
                <div className="text-sm text-stone-600">
                  <p className="font-medium text-stone-800">{q.name}</p>
                  <p>
                    <a href={`mailto:${q.email}`} className="text-teal-800 hover:underline">
                      {q.email}
                    </a>
                    {/* Phone numbers read left-to-right, so the + stays in front in Arabic. */}
                    {q.phone && (
                      <span className="ms-2 text-stone-500">
                        · <span dir="ltr">{q.phone}</span>
                      </span>
                    )}
                  </p>
                </div>
                <p className="whitespace-pre-line text-sm text-stone-700">{q.message}</p>
                <p className="text-xs text-stone-400">{dateFmt.format(q.createdAt)}</p>

                <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                  {(["CONTACTED", "CLOSED", "SPAM"] as const).map((s) => (
                    <form key={s} action={setEnquiryStatusAgency}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="status" value={s} />
                      <button
                        type="submit"
                        disabled={q.status === s}
                        className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200 disabled:opacity-40"
                      >
                        {t(`enquiries.mark.${s}`)}
                      </button>
                    </form>
                  ))}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
