import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { generateToken } from "../../../../lib/auth/tokens";
import { sendVerificationEmail } from "../../../../lib/email/templates";
import { isRateLimited } from "../../../../lib/auth/rate-limit";

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
  if (user && !user.emailVerified) {
    const { raw, hash } = generateToken();
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    await sendVerificationEmail(user.email, `${process.env.NEXTAUTH_URL}/verificar-email?token=${raw}`);
  }

  return Response.json({ ok: true });
}