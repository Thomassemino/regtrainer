import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";
import { pesosACentavos, centavosAPesos } from "../../../../../lib/dinero";

const ActualizarServicioSchema = z.object({
  nombre: z.string().min(2).max(80).optional(),
  tag: z.string().min(1).max(30).optional(),
  descripcion: z.string().max(2000).optional(),
  imagenUrl: z.string().max(5_000_000).optional(),
  duracionMin: z.number().int().min(0).max(300).optional(),
  precioPesos: z.number().int().min(0).max(10_000_000).optional(),
  cupoMax: z.number().int().min(1).max(999).optional(),
  activo: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  const parsed = ActualizarServicioSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { precioPesos, ...resto } = parsed.data;

  try {
    const servicio = await prisma.servicio.update({
      where: { id },
      data: { ...resto, ...(precioPesos !== undefined ? { precio: pesosACentavos(precioPesos) } : {}) },
      include: { horarios: { orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] } },
    });
    return Response.json({ servicio: { ...servicio, precioPesos: centavosAPesos(servicio.precio) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return Response.json({ error: "Servicio no encontrado" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  try {
    await prisma.servicio.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return Response.json({ error: "Servicio no encontrado" }, { status: 404 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return Response.json({ error: "No se puede borrar: tiene clases o reservas asociadas. Desactivalo en su lugar." }, { status: 409 });
    }
    throw e;
  }
}
