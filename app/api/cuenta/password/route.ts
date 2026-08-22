import { z } from "zod";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { hashPassword, verifyPassword } from "../../../../lib/auth/hash";
import { logAudit } from "../../../../lib/auth/audit";
import { isRateLimited } from "../../../../lib/auth/rate-limit";
import { getClientIp } from "../../../../lib/auth/ip";

const Schema = z.object({
  actual: z.string().min(1),
  nueva: z.string().min(10).max(128).regex(/[a-zA-Z]/).regex(/[0-9]/),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || !session.user.id || !session.user.sessionId) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "La contraseña debe tener al menos 10 caracteres y combinar letras y números" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const ip = getClientIp(req);
  if (await isRateLimited({ email: user.email, ip, action: "LOGIN_FAILED" })) {
    return Response.json({ error: "Demasiados intentos, esperá unos minutos" }, { status: 429 });
  }

  const ok = await verifyPassword(user.passwordHash, parsed.data.actual);
  if (!ok) {
    await logAudit({ userId: user.id, email: user.email, action: "LOGIN_FAILED", ip });
    return Response.json({ error: "contraseña actual incorrecta" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.nueva) },
  });
  await prisma.session.deleteMany({ where: { userId: user.id, id: { not: session.user.sessionId } } });
  await logAudit({ userId: user.id, action: "PASSWORD_CAMBIADA" });
  await logAudit({ userId: user.id, action: "SESION_REVOCADA" });

  return Response.json({ ok: true });
}