// Server-side wrapper around the pure tag builders in seoCore.ts: reads the
// reader's language, the site name and the web address, so a public page's
// generateMetadata is one line:
//   return pageMetadata({ path: "/market", title: t("title") });
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteUrl } from "./siteUrl";
import { buildPageMetadata, defaultShareImage, type ShareImage } from "./seoCore";

export async function pageMetadata(opts: {
  /** Path without the language prefix and without a query string. */
  path: string;
  title?: string;
  description?: string;
  image?: ShareImage;
  noindex?: boolean;
  follow?: boolean;
}): Promise<Metadata> {
  const locale = await getLocale();
  const [tc, ts] = await Promise.all([
    getTranslations({ locale, namespace: "common" }),
    getTranslations({ locale, namespace: "seo" }),
  ]);
  const base = getSiteUrl();
  return buildPageMetadata({
    base,
    locale,
    path: opts.path,
    title: opts.title,
    description: opts.description ?? tc("tagline"),
    siteName: tc("appName"),
    image: opts.image ?? (base ? defaultShareImage(base, ts("defaultShareAlt")) : undefined),
    noindex: opts.noindex,
    follow: opts.follow,
  });
}
