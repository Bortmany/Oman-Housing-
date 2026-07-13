import { prisma } from "@/lib/prisma";
import type { ListingStatus, Prisma, Tier } from "@prisma/client";

// Estate agencies and the queries the agency portal + admin need. An agency is
// created UNAPPROVED at signup; the owner approves it before anything it posts
// can go live. Tier caps how many listings it may have "in play" (see tiers.ts).

// Listings that count against an agency's plan: live OR awaiting review.
// REJECTED / ARCHIVED / SOLD / RENTED no longer occupy an active slot.
const IN_PLAY_STATUSES: ListingStatus[] = ["PENDING_REVIEW", "ACTIVE"];

export async function agencyById(id: string) {
  return prisma.agency.findUnique({ where: { id } });
}

/** Count of an agency's listings that are live or awaiting review (its plan usage). */
export async function countListingsInPlay(agencyId: string): Promise<number> {
  return prisma.listing.count({
    where: { agencyId, status: { in: IN_PLAY_STATUSES } },
  });
}

const agencyListingInclude = {
  property: { include: { neighborhood: { include: { city: true } } } },
} satisfies Prisma.ListingInclude;

export type AgencyListing = Prisma.ListingGetPayload<{
  include: typeof agencyListingInclude;
}>;

export async function agencyListings(agencyId: string): Promise<AgencyListing[]> {
  return prisma.listing.findMany({
    where: { agencyId },
    include: agencyListingInclude,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

// ---------- Signup ----------

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "agency";
}

/** Create an agency + its first owner user in one transaction. Unapproved. */
export async function createAgencyWithOwner(input: {
  agencyNameEn: string;
  agencyNameAr: string | null;
  licenseNo: string | null;
  phone: string | null;
  contactName: string;
  email: string;
  passwordHash: string;
  locale: string;
}): Promise<{ ok: true } | { ok: false; reason: "emailTaken" }> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, reason: "emailTaken" };

  // Ensure a unique slug (the column is @unique).
  let slug = slugify(input.agencyNameEn);
  for (let i = 0; i < 5; i++) {
    const taken = await prisma.agency.findUnique({ where: { slug } });
    if (!taken) break;
    slug = `${slugify(input.agencyNameEn)}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  await prisma.agency.create({
    data: {
      slug,
      nameEn: input.agencyNameEn,
      nameAr: input.agencyNameAr,
      licenseNo: input.licenseNo,
      phone: input.phone,
      email,
      isApproved: false,
      tier: "FREE",
      users: {
        create: {
          name: input.contactName,
          email,
          passwordHash: input.passwordHash,
          role: "AGENCY",
          locale: input.locale,
          phone: input.phone,
        },
      },
    },
  });
  return { ok: true };
}

export async function updateAgencyProfile(
  agencyId: string,
  data: {
    nameEn: string;
    nameAr: string | null;
    licenseNo: string | null;
    email: string | null;
    phone: string | null;
  },
) {
  await prisma.agency.update({ where: { id: agencyId }, data });
}

// ---------- Admin ----------

export async function allAgencies() {
  return prisma.agency.findMany({
    orderBy: [{ isApproved: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { users: true, listings: true } },
    },
    take: 200,
  });
}

export async function setAgencyApproval(agencyId: string, isApproved: boolean) {
  await prisma.agency.update({ where: { id: agencyId }, data: { isApproved } });
}

/** Grant/change an agency's plan — also mirrors onto its users so the tier
 *  shows on their account and session. This is the switch payments will flip. */
export async function setAgencyTier(agencyId: string, tier: Tier) {
  await prisma.$transaction([
    prisma.agency.update({ where: { id: agencyId }, data: { tier } }),
    prisma.user.updateMany({ where: { agencyId }, data: { tier } }),
  ]);
}
