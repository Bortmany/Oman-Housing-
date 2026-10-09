import { getLocale, getTranslations } from "next-intl/server";
import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enforceAdminPage } from "@/lib/require-admin";
import { formatDateTime, localName } from "@/lib/i18nData";
import { formatOMR } from "@/lib/money";
import { ROUTINE_KINDS } from "@/lib/payments/core";
import { isThawaniEnabled } from "@/lib/payments/thawani";
import { parseThawaniEnv } from "@/lib/payments/thawaniCore";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { featureByHandAction, recheckPaymentAction, stopFeaturingAction } from "./actions";
import { PendingButton } from "./PendingButton";

export async function generateMetadata() {
  const t = await getTranslations("adminPayments");
  return { title: t("title") };
}

const STATUSES: PaymentStatus[] = ["PENDING", "PAID", "FAILED"];
const inputClass =
  "mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; listing?: string; done?: string; error?: string }>;
}) {
  await enforceAdminPage(); // guard BEFORE any DB query (see require-admin.ts)
  const sp = await searchParams;
  const statusFilter = STATUSES.includes(sp.status as PaymentStatus) ? (sp.status as PaymentStatus) : undefined;
  const now = new Date();

  const [t, locale, payments, events, featured, liveListings] = await Promise.all([
    getTranslations("adminPayments"),
    getLocale(),
    prisma.payment.findMany({
      where: statusFilter ? { status: statusFilter } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { email: true } } },
    }),
    prisma.paymentEvent.findMany({
      where: { kind: { notIn: ROUTINE_KINDS } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.listing.findMany({
      where: { featuredUntil: { gt: now } },
      orderBy: { featuredUntil: "asc" },
      take: 100,
      select: { id: true, featuredUntil: true, property: { select: { titleEn: true, titleAr: true } } },
    }),
    prisma.listing.findMany({
      where: { status: "ACTIVE", isSample: false, property: { isSample: false } },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: { id: true, property: { select: { titleEn: true, titleAr: true } } },
    }),
  ]);

  const dt = (d: Date) => formatDateTime(locale, d);
  const preselect = typeof sp.listing === "string" ? sp.listing.slice(0, 64) : "";
  const enabled = isThawaniEnabled();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
        <Link href="/admin/settings/prices" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 hover:underline dark:text-teal-300">
          {t("pricesLink")}
        </Link>
      </div>

      {sp.done && t.has(`done.${sp.done}`) && (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-100">
          {t(`done.${sp.done}`)}
        </p>
      )}
      {sp.error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-900 ring-1 ring-inset ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">
          {t.has(`errors.${sp.error}`) ? t(`errors.${sp.error}`) : t("errors.failed")}
        </p>
      )}

      <p className="text-sm text-stone-600 dark:text-stone-300">
        {enabled ? t("gatewayOn", { env: parseThawaniEnv(process.env.THAWANI_ENV) }) : t("gatewayOff")}
      </p>

      {/* Feature by hand */}
      <Card id="hand" className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{t("featureByHand")}</h2>
        <p className="text-sm text-stone-600 dark:text-stone-300">{t("featureByHandHelp")}</p>
        <form action={featureByHandAction} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-800 dark:text-stone-200 sm:col-span-2">
            {t("chooseListing")}
            <select name="listingId" required defaultValue={preselect} className={inputClass}>
              <option value="" disabled>{t("chooseListing")}</option>
              {liveListings.map((l) => (
                <option key={l.id} value={l.id}>{localName(locale, l.property.titleEn, l.property.titleAr)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
            {t("amountReceived")}
            <input name="amount" required inputMode="decimal" dir="ltr" placeholder="3.000" defaultValue="3.000" className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
            {t("days")}
            <input name="days" required inputMode="numeric" dir="ltr" placeholder="30" defaultValue="30" className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-stone-800 dark:text-stone-200 sm:col-span-2">
            {t("invoiceNote")}
            <input name="note" maxLength={300} className={inputClass} />
          </label>
          <div className="sm:col-span-2">
            <PendingButton className="w-full sm:w-auto">{t("confirm")}</PendingButton>
          </div>
        </form>
      </Card>

      {/* Currently featured */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{t("currentlyFeatured")}</h2>
        {featured.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">{t("noneFeatured")}</p>
        ) : (
          <ul className="space-y-3">
            {featured.map((l) => (
              <li key={l.id}>
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-stone-900 dark:text-stone-100">{localName(locale, l.property.titleEn, l.property.titleAr)}</span>
                    <span className="text-sm text-stone-600 dark:text-stone-300">{t("featuredUntil", { date: dt(l.featuredUntil!) })}</span>
                  </div>
                  <form action={stopFeaturingAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input type="hidden" name="listingId" value={l.id} />
                    <label className="block flex-1 text-sm font-medium text-stone-800 dark:text-stone-200">
                      {t("stopReason")}
                      <input name="reason" maxLength={150} className={inputClass} />
                    </label>
                    <PendingButton variant="danger">{t("stopFeaturing")}</PendingButton>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Payments */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{t("payments")}</h2>
        <nav className="flex flex-wrap gap-2" aria-label={t("payments")}>
          {[undefined, ...STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={s ? `/admin/payments?status=${s}` : "/admin/payments"}
              aria-current={statusFilter === s ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium ring-1 ${
                statusFilter === s
                  ? "bg-teal-800 text-white ring-teal-800"
                  : "bg-white text-stone-700 ring-stone-300 hover:bg-stone-100 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700"
              }`}
            >
              {s ? t(`status.${s}`) : t("filterAll")}
            </Link>
          ))}
        </nav>
        {payments.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">{t("noPayments")}</p>
        ) : (
          <ul className="space-y-3">
            {payments.map((p) => (
              <li key={p.id}>
                <Card className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-stone-900 dark:text-stone-100">
                      {p.listingId ? p.listingTitle : `${p.listingTitle} ${t("deletedListing")}`}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                        p.status === "PAID"
                          ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300"
                          : p.status === "FAILED"
                            ? "bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-50 text-amber-900 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-200"
                      }`}
                    >
                      {t(`status.${p.status}`)}
                    </span>
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 text-stone-600 dark:text-stone-300 sm:grid-cols-2 lg:grid-cols-3">
                    <div><dt className="inline font-medium">{t("col.date")}: </dt><dd className="inline">{dt(p.createdAt)}</dd></div>
                    <div><dt className="inline font-medium">{t("col.payer")}: </dt><dd className="inline" dir="ltr">{p.user.email}</dd></div>
                    <div><dt className="inline font-medium">{t("col.method")}: </dt><dd className="inline">{t(`method.${p.method}`)}</dd></div>
                    <div><dt className="inline font-medium">{t("col.amount")}: </dt><dd className="inline" dir="ltr">{formatOMR(p.amount.toString(), locale)} · {t("perDays", { count: p.days })}</dd></div>
                    <div><dt className="inline font-medium">{t("col.reference")}: </dt><dd className="inline" dir="ltr">{p.id.slice(-8).toUpperCase()}{p.gatewaySessionId ? ` · ${p.gatewaySessionId.slice(-8)}` : ""}</dd></div>
                    {p.note && <div className="sm:col-span-2"><dd className="inline">{p.note}</dd></div>}
                  </dl>
                  {p.status !== "PAID" && p.method === "THAWANI" && p.gatewaySessionId && (
                    <form action={recheckPaymentAction}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <PendingButton variant="secondary">{t("recheck")}</PendingButton>
                    </form>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Security log */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{t("securityLog")}</h2>
        <p className="text-sm text-stone-600 dark:text-stone-300">{t("securityLogHelp")}</p>
        {events.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">{t("noEvents")}</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl bg-white ring-1 ring-stone-200 dark:divide-stone-800 dark:bg-stone-900 dark:ring-stone-800">
            {events.map((e) => (
              <li key={e.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-stone-900 dark:text-stone-100">{t(`event.${e.kind}`)}</span>
                  <span className="text-xs text-stone-500 dark:text-stone-400">{dt(e.createdAt)}</span>
                </div>
                <p className="text-stone-600 dark:text-stone-300">{e.detail}</p>
                {e.paymentId && <p className="text-xs text-stone-500 dark:text-stone-400" dir="ltr">{e.paymentId.slice(-8).toUpperCase()}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
