import { prisma } from "../db";
import { hashPassword } from "./hash";
import { hashToken } from "./tokens";
import { cerrarTodasLasSesiones } from "./sesiones";
import { logAudit } from "./audit";

export async function resetearPassword(rawToken: string, nuevaPassword: string): Promise<boolean> {
  const tokenHash = hashToken(rawToken);
  const tokenRow = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt < new Date()) {
    return false;
  }
  const passwordHash = await hashPassword(nuevaPassword);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: tokenRow.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: tokenRow.userId }, data: { passwordHash } }),
  ]);
  await cerrarTodasLasSesiones(tokenRow.userId);
  await logAudit({ userId: tokenRow.userId, action: "PASSWORD_RESET_COMPLETADO" });
  return true;
}