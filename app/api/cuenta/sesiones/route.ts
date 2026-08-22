import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { maskIp } from "../../../../lib/auth/ip";

export async function GET() {
  const session = await auth();
  if (!session?.user || !session.user.id || !session.user.sessionId) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const sesiones = await prisma.session.findMany({
    where: { userId: session.user.id, expires: { gt: new Date() } },
    select: { id: true, ip: true, userAgent: true, createdAt: true, expires: true },
    orderBy: { createdAt: "desc" },
  });
  const sesionesSeguras = sesiones.map((s) => ({ ...s, ip: maskIp(s.ip) }));
  return Response.json({ sesiones: sesionesSeguras, actualId: session.user.sessionId });
}