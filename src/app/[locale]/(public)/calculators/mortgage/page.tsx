import { getTranslations } from "next-intl/server";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { MortgageForm } from "./MortgageForm";

export async function generateMetadata() {
  const t = await getTranslations("calculators.mortgage");
  return { title: t("title") };
}

export default async function MortgagePage() {
  const t = await getTranslations("calculators.mortgage");
  return (
    <CalculatorShell title={t("title")} description={t("description")}>
      <MortgageForm />
    </CalculatorShell>
  );
}
