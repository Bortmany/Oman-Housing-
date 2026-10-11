// Bilingual DATA fields (not UI strings): Arabic is optional in the database,
// so Arabic UI falls back to the English value rather than blocking.
export function localName(
  locale: string,
  nameEn: string,
  nameAr?: string | null,
): string {
  return locale === "ar" && nameAr ? nameAr : nameEn;
}

/** True when the Arabic UI is showing an untranslated English value. */
export function isEnglishFallback(
  locale: string,
  nameAr?: string | null,
): boolean {
  return locale === "ar" && !nameAr;
}

export function formatMonth(locale: string, date: Date): string {
  return new Intl.DateTimeFormat(
    locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM",
    { month: "short", year: "numeric" },
  ).format(date);
}

/** Date and time in Oman time, Latin digits (used for "last computed" notes). */
export function formatDateTime(locale: string, date: Date): string {
  return new Intl.DateTimeFormat(
    locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM",
    { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" },
  ).format(date);
}
