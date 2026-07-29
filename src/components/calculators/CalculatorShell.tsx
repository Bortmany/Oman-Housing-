import { getTranslations } from "next-intl/server";
import { DirectionalLink } from "@/components/ui/DirectionalLink";

// Shared page frame for the three calculators: back link, title, disclaimer.
export async function CalculatorShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("calculators");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <DirectionalLink
        direction="back"
        href="/calculators"
        className="text-sm text-teal-800 hover:underline"
      >
        {t("title")}
      </DirectionalLink>
      <h1 className="mt-3 text-3xl font-bold text-stone-900">{title}</h1>
      <p className="mt-2 text-sm text-stone-600">{description}</p>
      <div className="mt-8">{children}</div>
      <p className="mt-8 rounded-lg bg-stone-100 p-4 text-xs text-stone-500">
        {t("disclaimer")}
      </p>
    </div>
  );
}
