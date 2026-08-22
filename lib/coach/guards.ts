import { auth } from "../auth";
import { prisma } from "../db";
import type { Session } from "next-auth";
import type { Cliente } from "@prisma/client";

type GuardOk<T> = T & { error?: undefined };
type GuardErr = { error: Response };

type SesionConUser = Session & { user: NonNullable<Session["user"]> };

export async function requireAdmin(): Promise<GuardOk<{ session: SesionConUser }> | GuardErr> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { error: Response.json({ error: "No autorizado" }, { status: session?.user ? 403 : 401 }) };
  }
  return { session: session as SesionConUser };
}

export async function requireClienteActual(): Promise<GuardOk<{ session: SesionConUser; cliente: Cliente }> | GuardErr> {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENTE") {
    return { error: Response.json({ error: "No autorizado" }, { status: session?.user ? 403 : 401 }) };
  }
  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return { error: Response.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { session: session as SesionConUser, cliente };
}