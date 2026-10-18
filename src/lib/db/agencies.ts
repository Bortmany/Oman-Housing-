import crypto from "crypto";
import { isUniqueViolation } from "@/lib/db/uniqueViolation";
import { profileChangeNeedsReview } from "@/lib/agencyReview";
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
  property: {
    include: {
      neighborhood: { include: { city: true } },
      images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
    },
  },
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

  // Unique slug (the column is @unique). First try the plain name, then a
  // random suffix; the database's unique rule is the final judge, so a
  // clash lost to a simultaneous signup just picks a new suffix and retries.
  const baseSlug = slugify(input.agencyNameEn);
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${crypto.randomBytes(4).toString("hex")}`;
    if (attempt === 0 && (await prisma.agency.findUnique({ where: { slug } }))) {
      continue;
    }
    try {
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
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // Taken email (lost a race) → tell the visitor; taken slug → retry.
      if (isUniqueViolation(e, "email")) return { ok: false, reason: "emailTaken" };
    }
  }
  throw new Error("Could not find a free agency slug");
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
  const current = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { nameEn: true, nameAr: true, licenseNo: true },
  });
  // Changing the name or licence of an approved agency sends it back to the
  // admin for another look (listings stay saved but the agency is unapproved).
  const needsReview = current ? profileChangeNeedsReview(current, data) : false;
  await prisma.agency.update({
    where: { id: agencyId },
    data: needsReview ? { ...data, isApproved: false } : data,
  });
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
