import { z } from "zod";
import type { Servicio, HorarioRecurrente } from "@prisma/client";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/coach/guards";
import { pesosACentavos, centavosAPesos } from "../../../../lib/dinero";

const ServicioSchema = z.object({
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  nombre: z.string().min(2).max(80),
  tag: z.string().min(1).max(30),
  descripcion: z.string().max(2000),
  imagenUrl: z.string().max(5_000_000).default(""),
  duracionMin: z.number().int().min(0).max(300),
  precioPesos: z.number().int().min(0).max(10_000_000),
  cupoMax: z.number().int().min(1).max(999),
  activo: z.boolean().default(true),
});

function serializar(s: Servicio & { horarios: HorarioRecurrente[] }) {
  return { ...s, precioPesos: centavosAPesos(s.precio) };
}

export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const servicios = await prisma.servicio.findMany({
    orderBy: { nombre: "asc" },
    include: { horarios: { orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] } },
  });

  return Response.json({ servicios: servicios.map(serializar) });
}

export async function POST(req: Request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const parsed = ServicioSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { precioPesos, ...resto } = parsed.data;

  const existente = await prisma.servicio.findUnique({ where: { slug: resto.slug } });
  if (existente) {
    return Response.json({ error: "Ya existe un servicio con ese slug" }, { status: 409 });
  }

  const servicio = await prisma.servicio.create({
    data: { ...resto, precio: pesosACentavos(precioPesos) },
    include: { horarios: true },
  });

  return Response.json({ servicio: serializar(servicio) }, { status: 201 });
}
