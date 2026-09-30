import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { agencyById } from "@/lib/db/agencies";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DataUploadForm } from "./DataUploadForm";

export async function generateMetadata() {
  const t = await getTranslations("agencyData");
  return { title: t("title") };
}

export default async function AgencyDataPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, session] = await Promise.all([getTranslations("agencyData"), auth()]);
  // The (agency) layout guards the role; this page also needs the agency link.
  // Same check as the actions: anyone else is sent away, not shown a blank page.
  if (session?.user.role !== "AGENCY" || !session.user.agencyId) {
    return redirect({ href: "/login", locale });
  }
  const agency = await agencyById(session.user.agencyId);
  if (!agency) return redirect({ href: "/login", locale });

  // Not approved yet: explain, offer the way back, show no upload box at all.
  if (!agency.isApproved) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
        <div
          role="status"
          className="mt-6 max-w-xl space-y-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-400/30"
        >
          <p className="font-semibold">{t("notApproved")}</p>
          <p>{t("notApprovedHint")}</p>
        </div>
        <div className="mt-4">
          <ButtonLink href="/agency" variant="ghost">
            {t("back")}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const steps = [t("step1"), t("step2"), t("step3")];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <DataUploadForm
        intro={
          <>
            <div>
              <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
              <p className="mt-2 text-sm text-stone-600 rtl:text-base dark:text-stone-400">{t("lede")}</p>
            </div>
            {/* Trust strip: nothing is public until the owner approves it. */}
            <div className="flex items-start gap-3 rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-200">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 size-5 shrink-0"
              >
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              <span>{t("trustStrip")}</span>
            </div>
            <Card>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{t("howItWorks")}</h2>
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
            </Card>
          </>
        }
      />
    </div>
  );
}
