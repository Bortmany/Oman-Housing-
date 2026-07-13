import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";

// Everything in this group requires the AGENCY role.
export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (session?.user.role !== "AGENCY") redirect({ href: "/login", locale });
  return <>{children}</>;
}
