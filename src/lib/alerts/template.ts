// The saved-search alert email: a pure function from data to
// { subject, text, html }. No database, no network — tested directly.
//
// Rules: plain text ALWAYS, HTML as well; every dynamic value escaped; Arabic
// HTML carries dir="rtl" (email clients drop <style>, so direction and spacing
// are attributes and inline styles only); money via formatOMRWhole, which uses
// Latin digits in both languages; each price carries its source label;
// sample listings are never shown, whatever the caller passes in.

import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";
import { escapeHtml } from "../escape-html";
import { formatOMRWhole } from "../money";
import { localName } from "../i18nData";

export const MAX_LISTINGS_PER_EMAIL = 5;

export type AlertLocale = "en" | "ar";

export type AlertListing = {
  propertyId: string;
  titleEn: string;
  titleAr: string | null;
  neighborhoodEn: string;
  neighborhoodAr: string | null;
  type: string;
  bedrooms: number | null;
  listingType: "SALE" | "RENT";
  rentPeriod: "MONTHLY" | "ANNUAL" | null;
  price: number | string;
  provenance: string;
  isSample: boolean;
};

export type AlertEmailInput = {
  locale: string;
  /** The saved search's name. */
  name: string;
  /** The recipient's name, if they gave one. */
  userName?: string | null;
  listings: AlertListing[];
  /** Total new matches (may be more than listings.length). */
  totalNew: number;
  /** True when the match search stopped at its fetch limit: show "200+", not "200". */
  totalCapped?: boolean;
  /** e.g. https://example.com — no trailing slash needed. */
  baseUrl: string;
  /** The saved query string, e.g. "hood=al-mouj&type=VILLA". */
  query: string;
  /** Signed one-click unsubscribe link for this search (see unsubscribe.ts). */
  unsubscribeUrl?: string;
};

export type AlertEmail = { subject: string; text: string; html: string };

const MESSAGES = { en, ar } as const;

export function toAlertLocale(locale: string | null | undefined): AlertLocale {
  return locale === "ar" ? "ar" : "en";
}

export function buildAlertEmail(input: AlertEmailInput): AlertEmail {
  const locale = toAlertLocale(input.locale);
  const rtl = locale === "ar";
  const messages = MESSAGES[locale] as unknown as Record<string, unknown>;
  const t = createTranslator({ locale, messages, namespace: "alertEmail" } as never) as (
    key: string,
    values?: Record<string, string>,
  ) => string;
  const tProv = createTranslator({ locale, messages, namespace: "provenance" } as never) as (
    key: string,
  ) => string;
  const tType = createTranslator({ locale, messages, namespace: "enums.propertyType" } as never) as (
    key: string,
  ) => string;
  const tCommon = createTranslator({ locale, messages, namespace: "common" } as never) as (
    key: string,
    values?: Record<string, string | number>,
  ) => string;
  const appName = (messages.common as { appName?: string } | undefined)?.appName ?? "";

  const base = input.baseUrl.replace(/\/+$/, "");
  const root = `${base}/${locale}`;
  const manageUrl = `${root}/account`;
  const seeAllUrl = `${root}/properties${input.query ? `?${input.query}` : ""}`;

  // Never a sample listing — the last line of defence.
  const real = input.listings.filter((l) => !l.isSample);
  const shown = real.slice(0, MAX_LISTINGS_PER_EMAIL);
  const total = Math.max(input.totalNew, real.length);
  const extra = Math.max(total - shown.length, 0);
  // At the fetch limit the true number is unknown: say "200+", never "200".
  const plus = input.totalCapped ? "+" : "";

  const subject = t("subject", { name: input.name }).replace(/[\r\n]+/g, " ");
  const greeting = input.userName?.trim()
    ? t("greeting", { name: input.userName.trim() })
    : t("greetingNoName");
  const intro = t("intro", { name: input.name });
  const countLine = t("countLine", { count: `${total}${plus}` });

  const items = shown.map((l) => {
    const title = localName(locale, l.titleEn, l.titleAr);
    const hood = localName(locale, l.neighborhoodEn, l.neighborhoodAr);
    const typeLabel = safeLabel(tType, l.type);
    const meta = [typeLabel, l.bedrooms != null ? tCommon("bedsCount", { count: l.bedrooms, n: String(l.bedrooms) }) : null, hood]
      .filter(Boolean)
      .join(" · ");
    const price = formatOMRWhole(l.price as number, locale);
    const asking =
      l.listingType === "SALE"
        ? t("askingSale", { price })
        : t(l.rentPeriod === "ANNUAL" ? "askingRentAnnual" : "askingRentMonthly", { price });
    const source = t("source", { label: safeLabel(tProv, l.provenance) });
    const url = `${root}/properties/${encodeURIComponent(l.propertyId)}`;
    return { title, meta, asking, source, url };
  });

  // ---- plain text (always) ----
  const textParts: string[] = [greeting, "", intro, countLine, ""];
  for (const it of items) {
    textParts.push(it.title, it.meta, it.asking, it.source, `${t("viewListing")}: ${it.url}`, "");
  }
  if (extra > 0) textParts.push(t("more", { count: `${extra}${plus}` }), `${t("seeAll")}: ${seeAllUrl}`, "");
  textParts.push(
    t("disclaimer"),
    "",
    t("whyYouGotThis", { appName }),
    t("manage", { url: manageUrl }),
  );
  if (input.unsubscribeUrl) textParts.push(t("unsubscribe", { url: input.unsubscribeUrl }));
  const text = textParts.join("\n");

  // ---- HTML ----
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const font = "font-family:Arial,Helvetica,sans-serif;color:#1c1917;";
  const card = (it: (typeof items)[number]) =>
    `<table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e5e4;border-radius:8px;margin:0 0 12px 0;">` +
    `<tr><td dir="${dir}" style="padding:12px 16px;text-align:${align};${font}">` +
    `<div style="font-size:16px;font-weight:bold;">${escapeHtml(it.title)}</div>` +
    `<div style="font-size:14px;color:#57534e;margin-top:4px;">${escapeHtml(it.meta)}</div>` +
    `<div style="font-size:15px;margin-top:8px;">${escapeHtml(it.asking)}</div>` +
    `<div style="font-size:13px;color:#57534e;margin-top:2px;">${escapeHtml(it.source)}</div>` +
    `<div style="margin-top:8px;"><a href="${escapeHtml(it.url)}" style="color:#0f766e;font-weight:bold;">${escapeHtml(t("viewListing"))}</a></div>` +
    `</td></tr></table>`;

  const html =
    `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>` +
    `<body dir="${dir}" style="margin:0;padding:0;background:#fafaf9;">` +
    `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(countLine)}</div>` +
    `<table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;"><tr><td align="center" style="padding:16px;">` +
    `<table role="presentation" dir="${dir}" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;"><tr><td dir="${dir}" style="text-align:${align};${font}font-size:15px;line-height:1.5;">` +
    `<p style="margin:0 0 8px 0;">${escapeHtml(greeting)}</p>` +
    `<p style="margin:0 0 8px 0;">${escapeHtml(intro)}</p>` +
    `<p style="margin:0 0 16px 0;font-weight:bold;">${escapeHtml(countLine)}</p>` +
    items.map(card).join("") +
    (extra > 0
      ? `<p style="margin:0 0 16px 0;">${escapeHtml(t("more", { count: `${extra}${plus}` }))} ` +
        `<a href="${escapeHtml(seeAllUrl)}" style="color:#0f766e;font-weight:bold;">${escapeHtml(t("seeAll"))}</a></p>`
      : "") +
    `<p style="margin:16px 0 0 0;font-size:13px;color:#57534e;">${escapeHtml(t("disclaimer"))}</p>` +
    `<p style="margin:8px 0 0 0;font-size:13px;color:#57534e;">${escapeHtml(t("whyYouGotThis", { appName }))} ` +
    `<a href="${escapeHtml(manageUrl)}" style="color:#0f766e;">${escapeHtml(t("manageLink"))}</a></p>` +
    (input.unsubscribeUrl
      ? `<p style="margin:8px 0 0 0;font-size:13px;color:#57534e;"><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#0f766e;">${escapeHtml(t("unsubscribeLink"))}</a></p>`
      : "") +
    `</td></tr></table></td></tr></table></body></html>`;

  return { subject, text, html };
}

function safeLabel(tr: (key: string) => string, key: string): string {
  try {
    return tr(key);
  } catch {
    return key;
  }
}
