import { useTranslations } from "next-intl";
import { phoneDigits } from "@/lib/contact";
import { Card } from "@/components/ui/Card";

// Straight-to-the-agent buttons, shown only when the listing's agency has a
// phone number on file. No number = nothing rendered (never a dead button).
export function ContactButtons({
  phone,
  agencyName,
}: {
  phone: string | null;
  agencyName: string;
}) {
  const t = useTranslations("enquiry");
  const digits = phoneDigits(phone);
  if (digits.length < 6) return null;

  const buttonClass =
    "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <Card>
      <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
        {t("contactTitle")}
      </h2>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
        {t("contactVia", { agency: agencyName })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`tel:+${digits}`}
          className={`${buttonClass} bg-teal-800 text-white hover:bg-teal-700 focus-visible:outline-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500`}
        >
          {t("call")}
        </a>
        <a
          href={`https://wa.me/${digits}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonClass} bg-white text-stone-900 ring-1 ring-stone-300 hover:bg-stone-100 focus-visible:outline-stone-400 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800`}
        >
          {t("whatsapp")}
        </a>
      </div>
      {/* The number itself, so it can be copied or dialed by hand. */}
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400" dir="ltr">
        +{digits}
      </p>
    </Card>
  );
}
