import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/auth/hash";
import { generateToken } from "../../../../lib/auth/tokens";
import { logAudit } from "../../../../lib/auth/audit";
import { sendVerificationEmail } from "../../../../lib/email/templates";

const RegistroSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).regex(/[a-zA-Z]/).regex(/[0-9]/),
  nombre: z.string().min(2),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = RegistroSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { email, password, nombre } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ ok: true }, { status: 201 });
  }

  const passwordHash = await hashPassword(password);
  const iniciales = nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "CLIENTE",
      cliente: { create: { nombre, iniciales, objetivo: "" } },
    },
  });

  const { raw, hash } = generateToken();
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const link = `${process.env.NEXTAUTH_URL}/verificar-email?token=${raw}`;
  await sendVerificationEmail(email, link);
  await logAudit({ userId: user.id, email, action: "REGISTRO" });

  return Response.json({ ok: true }, { status: 201 });
}