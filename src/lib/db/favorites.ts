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
    await prisma.favorite.create({ data: { userId, listingId } });
  }
}

export async function favoritesForUser(userId: string) {
  return prisma.favorite.findMany({
    where: { userId },
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
