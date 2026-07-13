import { getLocale, getTranslations } from "next-intl/server";
import type { InquiryStatus } from "@prisma/client";
import { allInquiries, INQUIRY_STATUSES } from "@/lib/db/inquiries";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { InquiryStatusPill } from "@/components/marketplace/InquiryStatusPill";
import { Link } from "@/i18n/navigation";
import { setInquiryStatusAdmin } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("inquiries.title") };
}

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = INQUIRY_STATUSES.includes(status as InquiryStatus)
    ? (status as InquiryStatus)
    : undefined;

  const [t, te, locale, inquiries] = await Promise.all([
    getTranslations("admin"),
    getTranslations("enums"),
    getLocale(),
    allInquiries(statusFilter),
  ]);
  const dateFmt = new Intl.DateTimeFormat(
    locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM",
    { dateStyle: "medium" },
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900">{t("inquiries.title")}</h1>
      <p className="mt-2 text-sm text-stone-600">{t("inquiries.subtitle")}</p>

      {/* Status filter chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/inquiries"
          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
            !statusFilter
              ? "bg-teal-800 text-white ring-teal-800"
              : "bg-white text-stone-600 ring-stone-300 hover:bg-stone-100"
          }`}
        >
          {t("allStatuses")}
        </Link>
        {INQUIRY_STATUSES.map((s) => (
          <Link
            key={s}
            href={{ pathname: "/admin/inquiries", query: { status: s } }}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              statusFilter === s
                ? "bg-teal-800 text-white ring-teal-800"
                : "bg-white text-stone-600 ring-stone-300 hover:bg-stone-100"
            }`}
          >
            {te(`inquiryStatus.${s}`)}
          </Link>
        ))}
      </div>

      {inquiries.length === 0 ? (
        <Card className="mt-6 text-center text-sm text-stone-500">
          {t("inquiries.empty")}
        </Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {inquiries.map((q) => (
            <li key={q.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/properties/${q.listing.propertyId}`}
                    className="font-medium text-stone-900 hover:text-teal-800"
                  >
                    {localName(locale, q.listing.property.titleEn, q.listing.property.titleAr)}
                  </Link>
                  <InquiryStatusPill status={q.status} />
                </div>
                <div className="text-sm text-stone-600">
                  <span className="font-medium text-stone-800">{q.name}</span> ·{" "}
                  <a href={`mailto:${q.email}`} className="text-teal-800 hover:underline">
                    {q.email}
                  </a>
                  {q.phone && <span className="ms-1">· {q.phone}</span>}
                  {q.listing.agency && (
                    <span className="ms-1 text-stone-400">
                      · {localName(locale, q.listing.agency.nameEn, q.listing.agency.nameAr)}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-line text-sm text-stone-700">{q.message}</p>
                <p className="text-xs text-stone-400">{dateFmt.format(q.createdAt)}</p>

                <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                  {INQUIRY_STATUSES.map((s) => (
                    <form key={s} action={setInquiryStatusAdmin}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="status" value={s} />
                      <button
                        type="submit"
                        disabled={q.status === s}
                        className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-200 disabled:opacity-40"
                      >
                        {te(`inquiryStatus.${s}`)}
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
