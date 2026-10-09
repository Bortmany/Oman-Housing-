import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/i18nData";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckAgainButton } from "./CheckAgainButton";

export const metadata = { robots: { index: false, follow: false } };

// The result of a payment. The state comes from OUR database, never from the
// address (the address carries only our own payment id). Only the payer sees
// it: anyone else, and an unknown id, get the standard not-found page.
export default async function FeatureResultPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();
  const { p } = await searchParams;
  const id = typeof p === "string" ? p.slice(0, 64) : "";
  if (!id) notFound();

  const payment = await prisma.payment.findFirst({
    where: { id, userId },
    select: {
      id: true,
      status: true,
      listing: { select: { id: true, featuredUntil: true } },
    },
  });
  if (!payment) notFound();

  const [t, locale] = await Promise.all([getTranslations("featured"), getLocale()]);
  // Letters and digits only; wrapped in a left-to-right isolate so it reads right inside Arabic text.
  const ref = `\u2066${payment.id.slice(-8).toUpperCase()}\u2069`;
  const isAgency = session?.user?.role === "AGENCY";
  const backHref = payment.listing
    ? `${isAgency ? "/agency/listings" : "/account/listings"}/${payment.listing.id}`
    : isAgency
      ? "/agency/listings"
      : "/account/listings";
  const until = payment.listing?.featuredUntil ?? null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("result.title")}</h1>
      <Card className="mt-4 space-y-4">
        {payment.status === "PAID" ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-100">
            {t("result.paid", { date: until ? formatDateTime(locale, until) : "" })}
          </p>
        ) : payment.status === "FAILED" ? (
          <p role="status" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-100">
            {t("result.failed", { ref })}
          </p>
        ) : (
          <>
            <p role="status" className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-100">
              {t("result.pending")}
            </p>
            <CheckAgainButton
              paymentId={payment.id}
              label={t("result.checkAgain")}
              workingLabel={t("result.checking")}
              rateLimited={t("errors.rateLimited")}
              failed={t("errors.startFailed")}
            />
          </>
        )}
        <p className="text-xs text-stone-500 dark:text-stone-400">
          {t("result.reference", { ref })}
        </p>
        <ButtonLink href={backHref} variant="secondary" className="w-full">{t("result.back")}</ButtonLink>
      </Card>
    </div>
  );
}
