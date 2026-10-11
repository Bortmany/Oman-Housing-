import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme";
import { StatsScript } from "@/components/analytics/StatsScript";
import { getSiteUrl } from "@/lib/siteUrl";
import { defaultShareImage, ogLocale } from "@/lib/seoCore";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, ts] = await Promise.all([
    getTranslations({ locale, namespace: "common" }),
    getTranslations({ locale, namespace: "seo" }),
  ]);
  const base = getSiteUrl();
  // Defaults for any page that sets no share tags of its own: the site name,
  // tagline and the default share image. Public pages override these through
  // pageMetadata() in src/lib/seo.ts.
  const images = base ? [defaultShareImage(base, ts("defaultShareAlt"))] : undefined;
  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    title: { default: t("appName"), template: `%s · ${t("appName")}` },
    description: t("tagline"),
    openGraph: {
      type: "website",
      siteName: t("appName"),
      title: t("appName"),
      description: t("tagline"),
      ...ogLocale(locale),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: t("appName"),
      description: t("tagline"),
      ...(images ? { images } : {}),
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${inter.variable} ${plexArabic.variable} h-full antialiased`}
      // The script below edits <html> before React hydrates, which is exactly
      // the kind of difference React would otherwise warn about.
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved light/dark choice before the first paint, so a
            dark-mode visitor never sees a white flash, and adds the `js`
            class that scroll-reveal content waits for. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          <ThemeProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </ThemeProvider>
        </NextIntlClientProvider>
        <StatsScript />
      </body>
    </html>
  );
}
