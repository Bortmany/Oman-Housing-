import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/lib/seo";
import { Hero } from "@/components/marketing/Hero";
import { HomeSearch } from "@/components/marketing/HomeSearch";
import { NeighborhoodShortcuts } from "@/components/marketing/NeighborhoodShortcuts";
import { TrendsShowcase } from "@/components/marketing/TrendsShowcase";
import { HonestData } from "@/components/marketing/HonestData";
import { CalculatorsGrid } from "@/components/marketing/CalculatorsGrid";
import { CtaBand } from "@/components/marketing/CtaBand";
import { Reveal } from "@/components/marketing/Reveal";
import { AdSlot } from "@/components/ads/AdSlot";

export async function generateMetadata() {
  const t = await getTranslations("footer");
  // Site name as the title; the home page is shared as the site itself.
  return pageMetadata({ path: "/", description: t("tagline") });
}

// The landing page: one home page combining the hero, mortgage slider, trend
// cards and "where every number comes from" section with the property search
// and neighborhood shortcuts. Sections live in src/components/marketing/; the
// trend cards show real stored market figures, each with its source badge.
export default function HomePage() {
  return (
    <div>
      <Hero search={<HomeSearch />} />
      <NeighborhoodShortcuts />
      {/* Paid band (always labelled "Ad"); renders nothing when no campaign is live. */}
      <Suspense fallback={null}>
        <AdSlot slot="HOME_BAND" className="mx-4 my-8 max-w-6xl min-[1216px]:mx-auto" />
      </Suspense>
      <Reveal>
        <TrendsShowcase />
      </Reveal>
      <Reveal>
        <HonestData />
      </Reveal>
      <Reveal>
        <CalculatorsGrid />
      </Reveal>
      <Reveal>
        <CtaBand />
      </Reveal>
    </div>
  );
}
