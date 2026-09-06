import { getTranslations } from "next-intl/server";
import { getPrivacyContactEmail } from "@/lib/legalContact";

// The "Contact" section shared by the Privacy Policy and Terms of Use pages.
// Server component: reads PRIVACY_CONTACT_EMAIL (or the owner's default) on
// the server and renders it as a mailto link inside the translated sentence.
// The address itself is Latin text, so the link is forced dir="ltr" — inside
// an Arabic (RTL) paragraph it would otherwise risk having its punctuation
// reordered by the browser's bidi algorithm.
export default async function LegalContact() {
  const tl = await getTranslations("legal");
  const contactEmail = getPrivacyContactEmail();

  return (
    <>
      <h2 className="mt-8 text-lg font-semibold text-stone-900">
        {tl("contactTitle")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-700">
        {tl.rich("contactBody", {
          contactEmail,
          mail: (chunks) => (
            <a
              href={`mailto:${contactEmail}`}
              dir="ltr"
              className="inline-block font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </>
  );
}
