-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerifyAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phoneVerifyCodeHash" TEXT,
ADD COLUMN     "phoneVerifyExpiresAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerifyPending" TEXT,
ADD COLUMN     "phoneVerifySentAt" TIMESTAMP(3);
