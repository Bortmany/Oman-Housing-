import { getLocale, getTranslations } from "next-intl/server";
import { enforceOwnerPage, ownerPhoneRow } from "@/lib/listings/ownerGuard";
import { listingsForActor, slotsUsed } from "@/lib/listings/core";
import { OWNER_LISTING_CAP, ownerHasSlot } from "@/lib/listings/rules";
import { isPhoneVerified } from "@/lib/phoneVerify";
import { isPhoneVerificationAvailable } from "@/lib/sms/send";
import { decimalToNumber, formatOMRWhole } from "@/lib/money";
import { localName } from "@/lib/i18nData";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { OwnStatusPill } from "@/components/listing-form/OwnStatusPill";
import { DismissibleNotice } from "@/components/listing-form/DismissibleNotice";

export async function generateMetadata() {
  const t = await getTranslations("owner");
  return { title: t("title") };
}

export default async function OwnerListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const actor = await enforceOwnerPage(); // guard BEFORE any query
  const [{ submitted }, t, tm, te, tp, locale] = await Promise.all([
    searchParams,
    getTranslations("owner"),
    getTranslations("myListing"),
    getTranslations("enums"),
    getTranslations("properties"),
    getLocale(),
  ]);

  const [listings, used, phoneRow] = await Promise.all([
    listingsForActor(actor),
    slotsUsed(actor),
    ownerPhoneRow(actor.userId),
  ]);
  const verified = isPhoneVerified(phoneRow);
  const hasSlot = ownerHasSlot(used);
  const smsAvailable = isPhoneVerificationAvailable();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{t("lede")}</p>
        </div>
        {verified && hasSlot && (
          <ButtonLink href="/account/listings/new" className="w-full sm:w-auto">{t("newListing")}</ButtonLink>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {submitted && <DismissibleNotice>{t("list.submittedNotice")}</DismissibleNotice>}

        {!verified &&
          (smsAvailable ? (
            <Card className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 ring-amber-600/20 dark:bg-amber-950 dark:ring-amber-400/30">
              <div>
                <p className="font-medium text-stone-900 dark:text-stone-100">{t("list.needsPhone")}</p>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{t("list.needsPhoneBody")}</p>
              </div>
              <ButtonLink href="/account/listings/verify-phone" className="w-full sm:w-auto">{t("list.verifyCta")}</ButtonLink>
            </Card>
          ) : (
            <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-100">
              {t("verify.notAvailable")}
            </p>
          ))}

        {verified && !hasSlot && (
          <p role="status" className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-100">
            {t("list.capReached", { limit: OWNER_LISTING_CAP })}
          </p>
        )}

        <div>
          <Tooltip label={t("list.capHint")} side="bottom">
            <p tabIndex={0} className="text-xs text-stone-500 dark:text-stone-400">
              {t("list.capLine", { used, limit: OWNER_LISTING_CAP })}
            </p>
          </Tooltip>
          <div aria-hidden="true" className="mt-1 flex w-32 gap-1">
            {Array.from({ length: OWNER_LISTING_CAP }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < used ? "bg-teal-700" : "bg-stone-200 dark:bg-stone-700"}`} />
            ))}
          </div>
        </div>
      </div>

      {listings.length === 0 ? (
        <Card className="mt-6 space-y-2 py-10 text-center">
          <p className="font-medium text-stone-900 dark:text-stone-100">{t("list.empty")}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">{t("list.emptyHint")}</p>
          <div className="pt-2">
            {verified && hasSlot ? (
              <ButtonLink href="/account/listings/new">{t("newListing")}</ButtonLink>
            ) : !verified && smsAvailable ? (
              <ButtonLink href="/account/listings/verify-phone">{t("list.verifyCta")}</ButtonLink>
            ) : null}
          </div>
        </Card>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 md:gap-6">
          {listings.map((l) => {
            const cover = l.property.images[0];
            const title = localName(locale, l.property.titleEn, l.property.titleAr);
            const draft = l.status === "DRAFT";
            return (
              <li key={l.id}>
                <Card className="relative flex h-full flex-col !p-0 transition-colors active:bg-stone-50 md:hover:ring-stone-400 dark:active:bg-stone-800 dark:md:hover:ring-stone-600">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/images/${cover.storagePath}`} alt="" className="aspect-video w-full rounded-t-xl object-cover md:aspect-[4/3]" />
                  ) : (
                    <div className="grid aspect-video w-full place-items-center rounded-t-xl bg-stone-100 px-4 text-center text-xs text-stone-500 md:aspect-[4/3] dark:bg-stone-800 dark:text-stone-400">
                      <span>
                        {tp("noPhotos")}
                        {draft && <span className="mt-1 block">{t("list.noPhotosAddHint")}</span>}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-bold text-teal-800 dark:text-teal-300">
                        {formatOMRWhole(decimalToNumber(l.price)!, locale)}
                        {l.listingType === "RENT" && l.rentPeriod && (
                          <span className="text-xs font-medium text-stone-500 dark:text-stone-400"> {te(`rentPeriod.${l.rentPeriod}`)}</span>
                        )}
                      </p>
                      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                        {l.listingType === "SALE" ? tp("sale") : tp("rent")}
                      </span>
                    </div>
                    <p className="line-clamp-2 font-medium text-stone-900 dark:text-stone-100">{title}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {localName(locale, l.property.neighborhood.nameEn, l.property.neighborhood.nameAr)} · {te(`propertyType.${l.property.type}`)}
                    </p>
                    <OwnStatusPill status={l.status} publishedBefore={l.publishedAt != null} withHint />
                    {l.status === "REJECTED" && (
                      <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:bg-rose-950 dark:text-rose-100">
                        {l.reviewNote ? tm("rejectedReason", { reason: l.reviewNote }) : tm("noReason")}
                      </p>
                    )}
                    <div className="mt-auto pt-2">
                      <Link
                        href={`/account/listings/${l.id}`}
                        className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
                          draft
                            ? "bg-teal-800 text-white hover:bg-teal-700 dark:bg-teal-600"
                            : "bg-white text-stone-900 ring-1 ring-stone-300 hover:bg-stone-100 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700"
                        }`}
                      >
                        {draft ? t("list.continue") : t("list.open")}
                      </Link>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
