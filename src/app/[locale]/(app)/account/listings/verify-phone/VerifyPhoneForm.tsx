"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { verifyPhoneAction, type VerifyState } from "./actions";
import { Input, Label, Hint, FieldError } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { checkPhone } from "@/lib/contact";

// Where "Continue" leads once the phone is confirmed (the owner's Add form).
const AFTER_VERIFY = "/account/listings/new";

type NonNullState = NonNullable<VerifyState>;

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
    />
  );
}

export function VerifyPhoneForm({
  initial,
  verifiedMasked,
}: {
  initial: NonNullState;
  /** Masked number already verified on this account, if any. */
  verifiedMasked: string | null;
}) {
  const t = useTranslations("owner.verify");
  const router = useRouter();
  const [state, action, pending] = useActionState<VerifyState, FormData>(
    verifyPhoneAction,
    initial,
  );
  const current: NonNullState = state ?? initial;

  const [number, setNumber] = useState("");
  const [touched, setTouched] = useState(false);
  // The code box empties itself after every server answer (typed text is
  // tied to the answer it was typed under).
  const [typed, setTyped] = useState({ nonce: -1, value: "" });
  const code = typed.nonce === current.nonce ? typed.value : "";
  const [nowMs, setNowMs] = useState(() => initial.nonce);

  // Resend countdown: the server says how many seconds are left when it
  // answers; the screen counts down from there.
  const endAt = current.resendIn ? current.nonce + current.resendIn * 1000 : 0;
  const remaining = Math.max(0, Math.ceil((endAt - nowMs) / 1000));
  const ticking = remaining > 0;
  useEffect(() => {
    // Catch up with the real clock first (the page may have been open a while).
    const first = setTimeout(() => setNowMs(Date.now()), 0);
    if (!ticking) return () => clearTimeout(first);
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [ticking, current.nonce]);

  // After a confirmed number, move on to the Add form (the Continue button is
  // there too, so nobody is stuck if this is slow).
  const done = current.step === "done";
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => router.push(AFTER_VERIFY), 1500);
    return () => clearTimeout(timer);
  }, [done, router]);

  const stepNumber = current.step === "phone" ? 1 : 2;
  const numberProblem = checkPhone("+968", number) !== null || number.trim() === "";
  const showPhoneError =
    current.error === "invalidPhone" ||
    current.error === "phoneInUse" ||
    (touched && number.trim() !== "" && numberProblem);
  const codeVoided = current.error === "expired" || current.error === "tooManyTries";

  return (
    <Card className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5 text-teal-700 dark:text-teal-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
        </div>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{t("why")}</p>
        {!done && (
          <div className="mt-3 flex items-center gap-2" aria-label={t("step", { n: stepNumber })}>
            <span aria-hidden="true" className="h-1.5 w-6 rounded-full bg-teal-700 dark:bg-teal-400" />
            <span
              aria-hidden="true"
              className={`h-1.5 w-6 rounded-full ${stepNumber === 2 ? "bg-teal-700 dark:bg-teal-400" : "bg-stone-200 dark:bg-stone-700"}`}
            />
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {t("step", { n: stepNumber })}
            </span>
          </div>
        )}
      </div>

      {done ? (
        <div
          role="status"
          className="space-y-4 rounded-lg bg-emerald-50 p-4 text-emerald-900 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-400/30"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5 9-10" />
            </svg>
            {t("done")}
          </p>
          <ButtonLink href={AFTER_VERIFY} className="w-full">
            {t("continue")}
          </ButtonLink>
        </div>
      ) : current.step === "phone" ? (
        <form action={action} noValidate className="space-y-4">
          {verifiedMasked && (
            <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-200">
              {t("alreadyVerified")}{" "}
              <bdi dir="ltr" className="font-semibold">{verifiedMasked}</bdi>
            </p>
          )}
          <div>
            <Label htmlFor="verify-phone">{t("phoneLabel")}</Label>
            {/* Code and digits read left to right even in Arabic. */}
            <div dir="ltr" className="flex gap-2">
              <span
                title={t("codeChip")}
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-stone-100 px-3 text-sm font-medium text-stone-700 ring-1 ring-inset ring-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700"
              >
                +968
              </span>
              <Input
                id="verify-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                maxLength={20}
                placeholder="9123 4567"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                onBlur={() => setTouched(true)}
                disabled={pending}
                error={showPhoneError}
                aria-describedby="verify-phone-hint"
              />
            </div>
            <div id="verify-phone-hint">
              <Hint>{t("phoneHint")}</Hint>
            </div>
            {showPhoneError && (
              <FieldError>
                {current.error === "phoneInUse"
                  ? t("errors.phoneInUse")
                  : t("errors.invalidPhone")}
              </FieldError>
            )}
            {current.error === "rateLimited" && <FieldError>{t("errors.rateLimited")}</FieldError>}
            {current.error === "sendFailed" && <FieldError>{t("errors.sendFailed")}</FieldError>}
            {current.error === "wait" && (
              <FieldError>{t("resendWait", { seconds: remaining || 1 })}</FieldError>
            )}
          </div>
          <Button
            type="submit"
            name="intent"
            value="send"
            className="w-full"
            disabled={pending || numberProblem || remaining > 0}
          >
            {pending ? (
              <>
                <Spinner />
                {t("sending")}
              </>
            ) : (
              t("sendCode")
            )}
          </Button>
          {remaining > 0 && current.error !== "wait" && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {t("resendWait", { seconds: remaining })}
            </p>
          )}
        </form>
      ) : (
        <form action={action} noValidate className="space-y-4">
          <p
            role="status"
            className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-400/30"
          >
            {t.rich("codeSent", {
              phone: current.masked ?? "",
              b: (chunks) => <bdi dir="ltr" className="font-bold">{chunks}</bdi>,
            })}
          </p>
          <div>
            <Label htmlFor="verify-code">{t("codeLabel")}</Label>
            <Input
              key={current.nonce}
              id="verify-code"
              name="code"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              placeholder={t("codePlaceholder")}
              value={code}
              onChange={(e) => setTyped({ nonce: current.nonce, value: e.target.value })}
              autoFocus={Boolean(current.error)}
              disabled={pending}
              error={Boolean(current.error) && current.error !== "wait"}
              aria-describedby="verify-code-error"
              className="text-center text-xl tracking-[0.4em]"
            />
            <div id="verify-code-error" aria-live="polite">
              {current.error === "wrongCode" && <FieldError>{t("errors.wrongCode")}</FieldError>}
              {current.error === "expired" && <FieldError>{t("errors.expired")}</FieldError>}
              {current.error === "tooManyTries" && <FieldError>{t("errors.tooManyTries")}</FieldError>}
              {current.error === "rateLimited" && <FieldError>{t("errors.rateLimited")}</FieldError>}
              {current.error === "sendFailed" && <FieldError>{t("errors.sendFailed")}</FieldError>}
              {current.error === "wrongCode" &&
                current.triesLeft !== undefined &&
                current.triesLeft <= 2 && (
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {t("triesLeft", { count: current.triesLeft })}
                  </p>
                )}
            </div>
          </div>
          <Button
            type="submit"
            name="intent"
            value="confirm"
            className="w-full"
            disabled={pending || codeVoided || code.replace(/\D/g, "").length < 6}
          >
            {pending ? (
              <>
                <Spinner />
                {t("checking")}
              </>
            ) : (
              t("confirm")
            )}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="submit"
              name="intent"
              value="resend"
              variant={codeVoided ? "primary" : "ghost"}
              disabled={pending || remaining > 0}
            >
              {t("resend")}
            </Button>
            <Button type="submit" name="intent" value="change" variant="ghost" disabled={pending}>
              {t("changeNumber")}
            </Button>
          </div>
          {remaining > 0 && (
            <p className="text-xs text-stone-500 dark:text-stone-400" aria-live="polite">
              {t("resendWait", { seconds: remaining })}
            </p>
          )}
          {current.resent && !current.error && (
            <p role="status" className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t("resent")}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
