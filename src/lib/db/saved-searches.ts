import { prisma } from "@/lib/prisma";
import { MAX_SAVED_SEARCHES, type Frequency } from "@/lib/savedSearch";

// Saved property searches. Every query here is scoped to the signed-in user's
// own id — a saved search belongs to one account and nobody else can read or
// delete it.

export async function savedSearchesForUser(userId: string) {
  return prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_SAVED_SEARCHES,
  });
}

export async function countSavedSearches(userId: string): Promise<number> {
  return prisma.savedSearch.count({ where: { userId } });
}

/** Already saved this exact search? Then don't store it twice. */
export async function findSavedSearchByQuery(userId: string, query: string) {
  return prisma.savedSearch.findFirst({ where: { userId, query } });
}

export async function createSavedSearch(input: {
  userId: string;
  name: string;
  query: string;
  frequency: Frequency;
}) {
  return prisma.savedSearch.create({ data: input });
}

/** Delete only if it belongs to this user (returns how many rows went). */
export async function deleteSavedSearch(
  userId: string,
  id: string,
): Promise<number> {
  const { count } = await prisma.savedSearch.deleteMany({
    where: { id, userId },
  });
  return count;
}
