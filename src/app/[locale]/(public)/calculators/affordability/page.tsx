import { getTranslations } from "next-intl/server";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { AffordabilityForm } from "./AffordabilityForm";

export async function generateMetadata() {
  const t = await getTranslations("calculators.affordability");
  return { title: t("title") };
}

export default async function AffordabilityPage() {
  const t = await getTranslations("calculators.affordability");
  return (
    <CalculatorShell title={t("title")} description={t("description")}>
      <AffordabilityForm />
    </CalculatorShell>
  );
}
