import { getLocale, getTranslations } from "next-intl/server";
import type { Tier } from "@prisma/client";
import { allAgencies } from "@/lib/db/agencies";
import { localName } from "@/lib/i18nData";
import { Card } from "@/components/ui/Card";
import { approveAgency, unapproveAgency, grantTier } from "./actions";

const TIERS: Tier[] = ["FREE", "PREMIUM", "BUSINESS"];

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("agencies.title") };
}

export default async function AdminAgenciesPage() {
  const [t, tag, locale, agencies] = await Promise.all([
    getTranslations("admin"),
    getTranslations("agency"),
    getLocale(),
    allAgencies(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900">{t("agencies.title")}</h1>
      <p className="mt-2 text-sm text-stone-600">{t("agencies.subtitle")}</p>

      {agencies.length === 0 ? (
        <Card className="mt-6 text-center text-sm text-stone-500">
          {t("agencies.empty")}
        </Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {agencies.map((a) => (
            <li key={a.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">
                      {localName(locale, a.nameEn, a.nameAr)}
                    </p>
                    <p className="text-sm text-stone-500">
                      {a.licenseNo && <span>{t("agencies.license")}: {a.licenseNo} · </span>}
                      {a.email ?? "—"}
                      {a.phone && <span> · {a.phone}</span>}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      {t("agencies.users", { count: a._count.users })} ·{" "}
                      {t("agencies.listings", { count: a._count.listings })}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      a.isApproved
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {a.isApproved ? t("agencies.approved") : t("agencies.pending")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3">
                  {/* Approve / unapprove */}
                  {a.isApproved ? (
                    <form action={unapproveAgency}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100">
                        {t("agencies.unapprove")}
                      </button>
                    </form>
                  ) : (
                    <form action={approveAgency}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="rounded-lg bg-teal-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700">
                        {t("agencies.approve")}
                      </button>
                    </form>
                  )}

                  {/* Grant a plan */}
                  <form action={grantTier} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <span className="text-sm text-stone-500">{t("agencies.plan")}:</span>
                    <select
                      name="tier"
                      defaultValue={a.tier}
                      className="rounded-lg border-0 bg-white px-2 py-1 text-sm ring-1 ring-inset ring-stone-300"
                    >
                      {TIERS.map((tier) => (
                        <option key={tier} value={tier}>{tag(`tier.${tier}`)}</option>
                      ))}
                    </select>
                    <button className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100">
                      {t("agencies.setPlan")}
                    </button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
