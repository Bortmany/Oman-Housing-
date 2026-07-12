import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";

// Everything in this group requires the ADMIN role.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (session?.user.role !== "ADMIN") redirect({ href: "/login", locale });
  return <>{children}</>;
}
