import { getTranslations } from "next-intl/server";
import { auth, signOut } from "@/auth";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";

export async function Header() {
  const [t, tc, session] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    auth(),
  ]);

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="me-auto flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-teal-800 text-sm font-bold text-white">
            OP
          </span>
          <span className="text-base font-semibold text-stone-900">
            {tc("appName")}
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-sm font-medium text-stone-600">
          <Link href="/market" className="hover:text-teal-800">
            {t("market")}
          </Link>
          <Link href="/calculators" className="hover:text-teal-800">
            {t("calculators")}
          </Link>
          {session?.user.role === "ADMIN" && (
            <Link href="/admin" className="hover:text-teal-800">
              {t("admin")}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          {session ? (
            <div className="flex items-center gap-3">
              <Link
                href="/account"
                className="text-sm font-medium text-stone-600 hover:text-teal-800"
              >
                {t("account")}
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button
                  type="submit"
                  className="text-sm font-medium text-stone-500 hover:text-teal-800"
                >
                  {t("signOut")}
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-teal-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              {t("signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
