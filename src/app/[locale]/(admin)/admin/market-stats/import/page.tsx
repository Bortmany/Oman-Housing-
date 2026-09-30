import { getTranslations } from "next-intl/server";
import { DirectionalLink } from "@/components/ui/DirectionalLink";
import { Card } from "@/components/ui/Card";
import { enforceAdminPage } from "@/lib/require-admin";
import { ImportForm } from "./ImportForm";

export default async function MarketStatsImportPage() {
  await enforceAdminPage(); // guard BEFORE anything else (see require-admin.ts)
  const [t, ta] = await Promise.all([
    getTranslations("adminImport"),
    getTranslations("admin"),
  ]);

  const steps = [t("step1"), t("step2"), t("step3")];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <DirectionalLink
        direction="back"
        href="/admin/market-stats"
        className="text-sm text-teal-800 hover:underline dark:text-teal-300"
      >
        {ta("marketStats")}
      </DirectionalLink>

      <ImportForm
        intro={
          <>
            <div>
              <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                {t("title")}
              </h1>
              <p className="mt-2 text-sm text-stone-600 rtl:text-base dark:text-stone-400">
                {t("lede")}
              </p>
            </div>
            <Card>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {t("howItWorks")}
              </h2>
              <ol className="mt-3 space-y-3">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-stone-700 dark:text-stone-300">
                    <span
                      aria-hidden="true"
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                    >
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
                {t("levelRule")}
              </p>
            </Card>
          </>
        }
      />
    </div>
  );
}
