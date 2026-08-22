import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { generateToken } from "../../../../lib/auth/tokens";
import { sendPasswordResetEmail } from "../../../../lib/email/templates";
import { isRateLimited } from "../../../../lib/auth/rate-limit";
import { logAudit } from "../../../../lib/auth/audit";

const Schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Email inválido" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (await isRateLimited({ email: parsed.data.email, ip })) {
    return Response.json({ error: "Demasiados intentos, esperá unos minutos" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const { raw, hash } = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await sendPasswordResetEmail(user.email, `${process.env.NEXTAUTH_URL}/resetear-password?token=${raw}`);
    await logAudit({ userId: user.id, email: user.email, action: "PASSWORD_RESET_SOLICITADO", ip });
  }

  return Response.json({ ok: true, message: "Si el email existe, te llegó un correo" });
}