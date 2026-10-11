import { loadAd } from "@/lib/ads/serve";
import type { AdSlotName } from "@/lib/ads/rules";
import { AdCard } from "./AdCard";

/**
 * Shows the one live ad for a slot, or NOTHING at all: no empty box, no
 * "advertise here" text, no gap. Per-area slots need the neighbourhood id and
 * never show another area's ad. Server component.
 */
export async function AdSlot({
  slot,
  neighborhoodId,
  className = "",
}: {
  slot: AdSlotName;
  neighborhoodId?: string | null;
  className?: string;
}) {
  const ad = await loadAd(slot, neighborhoodId);
  if (!ad) return null;
  return <AdCard ad={ad} className={className} />;
}
