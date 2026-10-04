import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { AffordabilityForm } from "./AffordabilityForm";

export async function generateMetadata() {
  const t = await getTranslations("calculators.affordability");
  return pageMetadata({ path: "/calculators/affordability", title: t("title"), description: t("description") });
}

export default async function AffordabilityPage() {
  const t = await getTranslations("calculators.affordability");
  return (
    <CalculatorShell title={t("title")} description={t("description")}>
      <AffordabilityForm />
    </CalculatorShell>
  );
}
