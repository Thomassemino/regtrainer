import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const sesiones = await prisma.session.findMany({
    where: { userId: session.user.id },
    select: { id: true, ip: true, userAgent: true, createdAt: true, expires: true },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ sesiones, actualId: session.user.sessionId });
}