"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  sendEnquiryAction,
  type EnquiryActionState,
} from "@/app/[locale]/(public)/properties/[id]/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Input,
  Select,
  Textarea,
  Label,
  Hint,
  FieldError,
} from "@/components/ui/Field";
import { Link } from "@/i18n/navigation";

export type ListingOption = { id: string; label: string };

const initialState: EnquiryActionState = { status: "idle" };

export function EnquiryCard({
  listings,
  signedIn,
  defaultName,
  defaultEmail,
  registerHref,
}: {
  listings: ListingOption[];
  signedIn: boolean;
  defaultName: string;
  defaultEmail: string;
  registerHref: string;
}) {
  const t = useTranslations("enquiry");
  const [state, formAction, pending] = useActionState(
    sendEnquiryAction,
    initialState,
  );

  if (listings.length === 0) return null;

  // Ring the specific box that failed, alongside the message text below.
  const invalid = (name: string) =>
    state.status === "error" && state.code === "invalid" && state.field === name;

  if (state.status === "sent") {
    return (
      <Card>
        <h2 className="text-base font-semibold text-stone-900">{t("title")}</h2>
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {t("sent")}
        </p>
        {state.savedToAccount && (
          <p className="mt-2 text-xs text-stone-500">{t("sentSaved")}</p>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-stone-900">{t("title")}</h2>
      <p className="mt-1 text-xs text-stone-500">{t("subtitle")}</p>

      {!signedIn && (
        <div className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {t("accountNudge")}{" "}
          <Link href={registerHref} className="font-semibold underline">
            {t("createAccount")}
          </Link>
        </div>
      )}

      <form action={formAction} className="mt-4 space-y-3">
        {listings.length === 1 ? (
          <input type="hidden" name="listingId" value={listings[0].id} />
        ) : (
          <div>
            <Label htmlFor="enq-listing">{t("aboutListing")}</Label>
            <Select
              id="enq-listing"
              name="listingId"
              disabled={pending}
              error={
                invalid("listingId") ||
                (state.status === "error" && state.code === "unavailable")
              }
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Honeypot: hidden from humans, tempting to bots. Must stay empty. */}
        <div aria-hidden className="hidden">
          <label>
            Company
            <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="enq-name">{t("name")}</Label>
            <Input
              id="enq-name"
              name="name"
              defaultValue={defaultName}
              maxLength={120}
              disabled={pending}
              required
              error={invalid("name")}
            />
          </div>
          <div>
            <Label htmlFor="enq-email">{t("email")}</Label>
            <Input
              id="enq-email"
              name="email"
              type="email"
              defaultValue={defaultEmail}
              maxLength={200}
              disabled={pending}
              required
              error={invalid("email")}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="enq-phone">{t("phone")}</Label>
          <Input
            id="enq-phone"
            name="phone"
            maxLength={40}
            disabled={pending}
            error={invalid("phone")}
          />
          <Hint>{t("phoneHint")}</Hint>
        </div>

        <div>
          <Label htmlFor="enq-message">{t("message")}</Label>
          <Textarea
            id="enq-message"
            name="message"
            rows={4}
            maxLength={1000}
            placeholder={t("messagePlaceholder")}
            disabled={pending}
            required
            error={invalid("message")}
          />
        </div>

        <FieldError>
          {state.status === "error"
            ? state.code === "rateLimited"
              ? t("errors.rateLimited")
              : state.code === "unavailable"
                ? t("errors.unavailable")
                : t("errors.invalid")
            : null}
        </FieldError>

        <Button type="submit" disabled={pending}>
          {pending ? t("sending") : t("send")}
        </Button>
      </form>
    </Card>
  );
}
