import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { agencyById } from "@/lib/db/agencies";
import { AgencyProfileForm } from "./AgencyProfileForm";

export default async function AgencyProfilePage() {
  const [t, session] = await Promise.all([getTranslations("agency"), auth()]);
  if (!session?.user.agencyId) return null;

  const agency = await agencyById(session.user.agencyId);
  if (!agency) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-stone-900">{t("nav.profile")}</h1>
      <p className="mt-1 text-sm text-stone-500">{t("profile.subtitle")}</p>
      <div className="mt-6">
        <AgencyProfileForm
          defaults={{
            nameEn: agency.nameEn,
            nameAr: agency.nameAr,
            licenseNo: agency.licenseNo,
            email: agency.email,
            phone: agency.phone,
          }}
        />
      </div>
    </div>
  );
}
