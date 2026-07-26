import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const [t, tn, tc] = await Promise.all([
    getTranslations("footer"),
    getTranslations("nav"),
    getTranslations("common"),
  ]);

  const explore = [
    { href: "/properties", label: tn("properties") },
    { href: "/market", label: tn("market") },
    { href: "/calculators", label: tn("calculators") },
  ];

  const platform = [
    { href: "/list-with-us", label: tn("agency") },
    { href: "/privacy", label: t("privacy") },
    { href: "/terms", label: t("terms") },
  ];

  return (
    <footer className="mt-12 border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="text-start">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-teal-800 text-sm font-bold text-white">
                OP
              </span>
              <span className="text-base font-semibold text-stone-900">
                {tc("appName")}
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone-500">
              {t("tagline")}
            </p>
          </div>

          <nav className="text-start">
            <h3 className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
              {t("explore")}
            </h3>
            <ul className="mt-3 space-y-2">
              {explore.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-stone-600 hover:text-teal-800"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="text-start">
            <h3 className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
              {t("platform")}
            </h3>
            <ul className="mt-3 space-y-2">
              {platform.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-stone-600 hover:text-teal-800"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 space-y-2 border-t border-stone-200 pt-4 text-xs text-stone-500">
          {/* The regulatory disclaimer lives here so it is on every page. */}
          <p>{t("disclaimer")}</p>
          <p>© {t("rights")}</p>
        </div>
      </div>
    </footer>
  );
}
