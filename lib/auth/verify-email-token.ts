import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { logAudit } from "./audit";

export async function verifyEmailToken(tokenHash: string): Promise<boolean> {
  const tokenRow = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
    return false;
  }
  const ok = await prisma.$transaction(async (tx) => {
    const claim = await tx.emailVerificationToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claim.count === 0) {
      return false;
    }
    try {
      await tx.user.update({ where: { id: tokenRow.userId }, data: { emailVerified: new Date() } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return false;
      }
      throw e;
    }
    return true;
  });
  if (ok) {
    await logAudit({ userId: tokenRow.userId, action: "EMAIL_VERIFICADO" });
  }
  return ok;
}