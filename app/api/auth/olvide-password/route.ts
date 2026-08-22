import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { generateToken } from "../../../../lib/auth/tokens";
import { sendPasswordResetEmail } from "../../../../lib/email/templates";
import { isRateLimited } from "../../../../lib/auth/rate-limit";
import { logAudit } from "../../../../lib/auth/audit";
import { getClientIp } from "../../../../lib/auth/ip";
import { normalizeEmail } from "../../../../lib/auth/email";
import { logger } from "../../../../lib/logger";

const Schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Email inválido" }, { status: 400 });
  }
  const email = normalizeEmail(parsed.data.email);
  const ip = getClientIp(req);
  if (await isRateLimited({ email, ip, action: "PASSWORD_RESET_SOLICITADO" })) {
    return Response.json({ error: "Demasiados intentos, esperá unos minutos" }, { status: 429 });
  }

  await logAudit({ email, action: "PASSWORD_RESET_SOLICITADO", ip });

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const { raw, hash } = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const link = `${process.env.NEXTAUTH_URL}/resetear-password?token=${raw}`;
    void sendPasswordResetEmail(user.email, link).catch((e) => {
      logger.error({ err: e }, "email de reset de contraseña no enviado");
    });
  }

  await new Promise((r) => setTimeout(r, 120));
  return Response.json({ ok: true, message: "Si el email existe, te llegó un correo" });
}