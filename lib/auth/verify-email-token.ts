import { prisma } from "../db";
import { logAudit } from "./audit";

export async function verifyEmailToken(tokenHash: string): Promise<boolean> {
  const tokenRow = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
    return false;
  }
  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: tokenRow.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: tokenRow.userId }, data: { emailVerified: new Date() } }),
  ]);
  await logAudit({ userId: tokenRow.userId, action: "EMAIL_VERIFICADO" });
  return true;
}