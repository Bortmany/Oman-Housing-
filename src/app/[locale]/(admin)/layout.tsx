import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";

// Everything in this group requires the ADMIN role.
// Signed-in areas are never offered to search engines (robots.txt also asks
// them to stay out; the real protection is the login gate in src/proxy.ts).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (session?.user.role !== "ADMIN") redirect({ href: "/login", locale });
  return <>{children}</>;
}
