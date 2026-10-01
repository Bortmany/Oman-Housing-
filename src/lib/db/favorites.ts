import { prisma } from "@/lib/prisma";

/** Which of these listings has the user favorited? (One batched query.) */
export async function isFavoritedSet(
  userId: string,
  listingIds: string[],
): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const rows = await prisma.favorite.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
}

export async function toggleFavorite(
  userId: string,
  listingId: string,
): Promise<void> {
  const existing = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
  } else {
    // Only a live listing can be saved — a pending or draft one is not public.
    const live = await prisma.listing.findFirst({
      where: { id: listingId, status: "ACTIVE" },
      select: { id: true },
    });
    if (live) await prisma.favorite.create({ data: { userId, listingId } });
  }
}

export async function favoritesForUser(userId: string) {
  return prisma.favorite.findMany({
    // A saved listing that is no longer live (withdrawn, sold, back in review)
    // drops out of the list rather than showing unreviewed content.
    where: { userId, listing: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    include: {
      listing: {
        include: {
          property: {
            include: {
              neighborhood: { include: { city: true } },
              images: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });
}
