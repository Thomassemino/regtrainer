import { z } from "zod";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/db";
import { crearReservaConCupo, RequierePagoError } from "../../../lib/reservas/crear";
import { puedeCancelarSinCargo } from "../../../lib/reservas/cancelar";

const Schema = z.object({
  claseId: z.string().min(1),
  medio: z.enum(["EFECTIVO"]).optional(),
});

export async function GET(_req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  // Hallazgo 1.4: el clienteId DERIVA de la sesión, nunca de un parámetro, para que
  // cada cliente vea solo sus propias reservas (mismo aislamiento que otros endpoints).
  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  const reservas = await prisma.reserva.findMany({
    where: { clienteId: cliente.id, estado: { in: ["CONFIRMADA", "LISTA_ESPERA"] } },
    include: { clase: { include: { servicio: true } } },
    orderBy: { clase: { fecha: "asc" } },
  });

  return Response.json({
    reservas: reservas.map((r) => ({
      id: r.id,
      claseId: r.claseId,
      fecha: r.clase.fecha.toISOString(),
      servicio: r.clase.servicio.nombre,
      servicioSlug: r.clase.servicio.slug,
      duracionMin: r.clase.servicio.duracionMin,
      estado: r.estado,
      esCancelable: r.estado === "CONFIRMADA" && puedeCancelarSinCargo(r.clase.fecha),
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
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
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  const clase = await prisma.clase.findUnique({
    where: { id: parsed.data.claseId },
    include: { servicio: true },
  });
  if (!clase || clase.cancelada) {
    return Response.json({ error: "Clase no encontrada" }, { status: 404 });
  }

  try {
    const resultado = await crearReservaConCupo({
      clienteId: cliente.id,
      claseId: clase.id,
      medio: parsed.data.medio ?? null,
    });
    return Response.json(resultado, { status: 201 });
  } catch (e) {
    if (e instanceof RequierePagoError) {
      return Response.json(
        { error: "Este servicio requiere pago", redirigirA: "/api/pagos/clase" },
        { status: 409 }
      );
    }
    throw e;
  }
}