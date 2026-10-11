import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { RoiForm } from "./RoiForm";

export async function generateMetadata() {
  const t = await getTranslations("calculators.roi");
  return pageMetadata({ path: "/calculators/roi", title: t("title"), description: t("description") });
}

export default async function RoiPage() {
  const t = await getTranslations("calculators.roi");
  return (
    <CalculatorShell title={t("title")} description={t("description")}>
      <RoiForm />
    </CalculatorShell>
  );
}
