import { prisma } from "@/lib/prisma";
import { MAX_ATTEMPTS } from "@/lib/phoneVerify";

/**
 * Use up one of the 5 code tries, in ONE database step ("add 1 only while the
 * count is still under 5"). Because the check and the add are the same step,
 * many guesses sent at once cannot all squeeze under the limit.
 *
 * Returns how many tries were used before this one, or null when none are left
 * (or the number being checked has changed).
 */
export async function claimCodeTry(userId: string, pending: string): Promise<number | null> {
  const claim = await prisma.user.updateMany({
    where: { id: userId, phoneVerifyPending: pending, phoneVerifyAttempts: { lt: MAX_ATTEMPTS } },
    data: { phoneVerifyAttempts: { increment: 1 } },
  });
  if (claim.count !== 1) return null;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneVerifyAttempts: true },
  });
  return Math.max(0, (row?.phoneVerifyAttempts ?? MAX_ATTEMPTS) - 1);
}
