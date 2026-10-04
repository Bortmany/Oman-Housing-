import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { RentalYieldForm } from "./RentalYieldForm";

export async function generateMetadata() {
  const t = await getTranslations("calculators.rentalYield");
  return pageMetadata({ path: "/calculators/rental-yield", title: t("title"), description: t("description") });
}

export default async function RentalYieldPage() {
  const t = await getTranslations("calculators.rentalYield");
  return (
    <CalculatorShell title={t("title")} description={t("description")}>
      <RentalYieldForm />
    </CalculatorShell>
  );
}
