import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/auth/hash";
import { generateToken } from "../../../../lib/auth/tokens";
import { logAudit } from "../../../../lib/auth/audit";
import { sendVerificationEmail } from "../../../../lib/email/templates";
import { isRateLimited } from "../../../../lib/auth/rate-limit";
import { getClientIp } from "../../../../lib/auth/ip";
import { normalizeEmail } from "../../../../lib/auth/email";
import { logger } from "../../../../lib/logger";

const RegistroSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128).regex(/[a-zA-Z]/).regex(/[0-9]/),
  nombre: z.string().min(2),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const parsed = RegistroSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { password, nombre } = parsed.data;
  const email = normalizeEmail(parsed.data.email);
  const ip = getClientIp(req);

  if (await isRateLimited({ email, ip, action: "REGISTRO" })) {
    return Response.json({ error: "Demasiados intentos, esperá unos minutos" }, { status: 429 });
  }

  const passwordHash = await hashPassword(password);
  await logAudit({ email, action: "REGISTRO", ip });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const iniciales = nombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("");

    let user: { id: string } | null = null;
    try {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: "CLIENTE",
          cliente: { create: { nombre, iniciales, objetivo: "" } },
        },
      });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) {
        throw e;
      }
    }

    if (user) {
      const { raw, hash } = generateToken();
      await prisma.emailVerificationToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });

      const link = `${process.env.NEXTAUTH_URL}/api/auth/verificar-email?token=${raw}`;
      void sendVerificationEmail(email, link).catch((e) => {
        logger.error({ err: e }, "email de verificación no enviado");
      });
    }
  }

  await new Promise((r) => setTimeout(r, 120));

  return Response.json({ ok: true }, { status: 201 });
}