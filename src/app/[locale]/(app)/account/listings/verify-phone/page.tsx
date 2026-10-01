import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSmsMode } from "@/lib/sms/send";
import {
  codeState,
  cooldownSecondsLeft,
  isPhoneVerified,
  maskPhone,
} from "@/lib/phoneVerify";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { VerifyPhoneForm } from "./VerifyPhoneForm";
import type { VerifyState } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("owner.verify");
  return { title: t("title") };
}

type NonNullState = NonNullable<VerifyState>;

// Works out which step the screen opens on, from what is stored for the user:
// a code already out -> step 2 (with the right message if it has lapsed),
// otherwise step 1.
function openingState(user: {
  phoneVerifyPending: string | null;
  phoneVerifyExpiresAt: Date | null;
  phoneVerifyAttempts: number;
  phoneVerifySentAt: Date | null;
}): NonNullState {
  const now = new Date();
  const nonce = now.getTime();
  const state = codeState(user, now);
  if (state === "none") return { step: "phone", nonce };
  const resendIn = cooldownSecondsLeft(user.phoneVerifySentAt, now);
  const masked = maskPhone(user.phoneVerifyPending);
  if (state === "locked") return { step: "code", masked, error: "tooManyTries", resendIn, nonce };
  if (state === "expired") return { step: "code", masked, error: "expired", resendIn, nonce };
  return { step: "code", masked, resendIn, nonce };
}

export default async function VerifyPhonePage() {
  const [t, session] = await Promise.all([getTranslations("owner.verify"), auth()]);
  if (!session?.user?.id) return null; // the (app) layout already redirects

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      phone: true,
      phoneVerifiedAt: true,
      phoneVerifyPending: true,
      phoneVerifyExpiresAt: true,
      phoneVerifyAttempts: true,
      phoneVerifySentAt: true,
    },
  });
  if (!user) return null;

  // No provider keys in production: owner listing is closed, so there is
  // nothing to submit here (the action refuses too).
  if (getSmsMode() === "closed") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="space-y-4">
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t("title")}</h1>
          <p
            role="status"
            className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-400/30"
          >
            {t("notAvailable")}
          </p>
          <ButtonLink href="/account" variant="secondary" className="w-full">
            {t("backToAccount")}
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <VerifyPhoneForm
        initial={openingState(user)}
        verifiedMasked={isPhoneVerified(user) ? maskPhone(user.phone) : null}
      />
    </div>
  );
}
