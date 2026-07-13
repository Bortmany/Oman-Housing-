import { prisma } from "@/lib/prisma";
import type { InquiryStatus, Prisma } from "@prisma/client";

// Enquiries a buyer sends about a listing. They reach the seller two ways:
// the listing's agency (via listing.agencyId) sees them in the agency inbox,
// and the admin sees every one. Buyer identity is captured inline (name/email/
// phone) with an optional fromUserId link when the buyer is logged in.

const inquiryInclude = {
  listing: {
    include: {
      property: { include: { neighborhood: { include: { city: true } } } },
      agency: true,
    },
  },
  fromUser: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InquiryInclude;

export type InquiryWithListing = Prisma.InquiryGetPayload<{
  include: typeof inquiryInclude;
}>;

export const INQUIRY_STATUSES: InquiryStatus[] = [
  "NEW",
  "CONTACTED",
  "CLOSED",
  "SPAM",
];

export async function createInquiry(data: {
  listingId: string;
  fromUserId: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string;
}) {
  return prisma.inquiry.create({ data });
}

/** How many enquiries this email has sent recently — the per-email spam cap. */
export async function countRecentInquiriesByEmail(
  email: string,
  sinceMs: number,
): Promise<number> {
  return prisma.inquiry.count({
    where: {
      email: email.toLowerCase(),
      createdAt: { gte: new Date(Date.now() - sinceMs) },
    },
  });
}

/** Inbox for one agency: enquiries on any listing that agency owns. */
export async function inquiriesForAgency(
  agencyId: string,
  status?: InquiryStatus,
): Promise<InquiryWithListing[]> {
  return prisma.inquiry.findMany({
    where: {
      listing: { agencyId },
      ...(status ? { status } : {}),
    },
    include: inquiryInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** Admin inbox: every enquiry, optionally filtered by status. */
export async function allInquiries(
  status?: InquiryStatus,
): Promise<InquiryWithListing[]> {
  return prisma.inquiry.findMany({
    where: status ? { status } : {},
    include: inquiryInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** A signed-in buyer's own enquiries, for the account page. */
export async function inquiriesForUser(
  userId: string,
): Promise<InquiryWithListing[]> {
  return prisma.inquiry.findMany({
    where: { fromUserId: userId },
    include: inquiryInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function setInquiryStatus(id: string, status: InquiryStatus) {
  await prisma.inquiry.update({ where: { id }, data: { status } });
}

/** Does this inquiry belong to a listing owned by this agency? (authz guard) */
export async function inquiryBelongsToAgency(
  id: string,
  agencyId: string,
): Promise<boolean> {
  const found = await prisma.inquiry.findFirst({
    where: { id, listing: { agencyId } },
    select: { id: true },
  });
  return found != null;
}
