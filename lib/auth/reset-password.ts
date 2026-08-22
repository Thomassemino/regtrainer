import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { hashPassword } from "./hash";
import { hashToken } from "./tokens";
import { logAudit } from "./audit";

export async function resetearPassword(rawToken: string, nuevaPassword: string): Promise<boolean> {
  const tokenHash = hashToken(rawToken);
  const tokenRow = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
    return false;
  }
  const passwordHash = await hashPassword(nuevaPassword);
  const ok = await prisma.$transaction(async (tx) => {
    const claim = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claim.count === 0) {
      return false;
    }
    try {
      await tx.user.update({ where: { id: tokenRow.userId }, data: { passwordHash } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return false;
      }
      throw e;
    }
    await tx.session.deleteMany({ where: { userId: tokenRow.userId } });
    return true;
  });
  if (ok) {
    await logAudit({ userId: tokenRow.userId, action: "PASSWORD_RESET_COMPLETADO" });
  }
  return ok;
}