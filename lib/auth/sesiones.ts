import { prisma } from "../db";
import { logAudit } from "./audit";

export async function cerrarTodasLasSesiones(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
  await logAudit({ userId, action: "SESION_REVOCADA" });
}