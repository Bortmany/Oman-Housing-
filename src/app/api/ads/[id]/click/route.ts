import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recordAdClick } from "@/lib/ads/core";
import { resolveClick } from "@/lib/ads/click";

// Counts a click and sends the visitor to the advertiser. The destination is
// ONLY the link stored on the campaign (nothing from this address is used),
// so it cannot be turned into an open redirect. No cookie, no address stored.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = getClientIp(req.headers);
  const result = await resolveClick(id, {
    find: (campaignId) =>
      prisma.adCampaign.findUnique({
        where: { id: campaignId },
        select: { linkUrl: true, isActive: true, startsAt: true, endsAt: true },
      }),
    allowCount: () => checkRateLimit(`ad:click:${id}:ip:${ip}`, { limit: 1, windowMs: 60_000 }).allowed,
    count: (campaignId) => recordAdClick(campaignId),
    now: new Date(),
  });

  if (result.status === 404) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: result.location,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
