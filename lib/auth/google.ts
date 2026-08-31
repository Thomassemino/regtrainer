import { prisma } from "../db";
import { crearSesionDb } from "./authorize";
import { logAudit } from "./audit";
import { normalizeEmail } from "./email";

function inicialesDe(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";
}

export async function googleLogin(params: {
  email: string;
  nombre?: string | null;
  imagen?: string | null;
  emailVerificado: boolean;
  ip: string;
  userAgent?: string;
}): Promise<{ id: string; email: string; role: "CLIENTE" | "ADMIN"; image: string | null; sessionId: string } | null> {
  if (!params.emailVerificado) {
    return null;
  }
  const email = normalizeEmail(params.email);
  const imagen = params.imagen?.trim() || null;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const nombre = params.nombre?.trim() || email.split("@")[0]!;
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: null,
        role: "CLIENTE",
        image: imagen,
        emailVerified: new Date(),
        cliente: { create: { nombre, iniciales: inicialesDe(nombre), objetivo: "" } },
      },
    });
    await logAudit({ email, userId: user.id, action: "REGISTRO", ip: params.ip, userAgent: params.userAgent });
  } else {
    const data: { emailVerified?: Date; image?: string | null } = {};
    if (!user.emailVerified) data.emailVerified = new Date();
    if (imagen && imagen !== user.image) data.image = imagen;
    if (Object.keys(data).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data });
    }
  }

  const dbSession = await crearSesionDb({ userId: user.id, ip: params.ip, userAgent: params.userAgent });
  await logAudit({ email, userId: user.id, action: "LOGIN_SUCCESS", ip: params.ip, userAgent: params.userAgent });

  return { id: user.id, email: user.email, role: user.role, image: user.image, sessionId: dbSession.id };
}
