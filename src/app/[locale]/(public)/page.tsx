import { Hero } from "@/components/marketing/Hero";
import { TrendsShowcase } from "@/components/marketing/TrendsShowcase";
import { HonestData } from "@/components/marketing/HonestData";
import { CalculatorsGrid } from "@/components/marketing/CalculatorsGrid";
import { CtaBand } from "@/components/marketing/CtaBand";
import { Reveal } from "@/components/marketing/Reveal";

// The landing page. Sections live in src/components/marketing/; the trend
// cards use hardcoded illustrative samples (labeled as such — real,
// source-labeled figures live on /market and /properties).
export default function HomePage() {
  return (
    <div>
      <Hero />
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
