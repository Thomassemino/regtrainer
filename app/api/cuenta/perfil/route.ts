import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const usuario = await prisma.user.findUnique({ where: { id: session.user.id } });
  const tienePassword = !!usuario?.passwordHash;

  if (session.user.role === "ADMIN") {
    return Response.json({
      role: "ADMIN",
      nombre: session.user.email.split("@")[0],
      iniciales: session.user.email.slice(0, 2).toUpperCase(),
      imagen: session.user.image ?? null,
      email: session.user.email,
      objetivo: null,
      tienePassword,
    });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 404 });
  }

  return Response.json({
    role: "CLIENTE",
    nombre: cliente.nombre,
    iniciales: cliente.iniciales,
    imagen: session.user.image ?? null,
    email: session.user.email,
    objetivo: cliente.objetivo,
    tienePassword,
  });
}
