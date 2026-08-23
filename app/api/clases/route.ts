import { z } from "zod";
import { prisma } from "../../../lib/db";
import { ensureClasesGeneradas } from "../../../lib/clases/generar";
import { logger } from "../../../lib/logger";

const QuerySchema = z.object({
  servicioId: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional(),
});

const SEIS_SEMANAS_MS = 6 * 7 * 24 * 60 * 60 * 1000;
const RANGO_MAX_MS = 12 * 7 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);

  try {
    await ensureClasesGeneradas();
  } catch (e) {
    logger.error({ err: e }, "error generando clases perezosamente");
    return Response.json({ error: "Servicio temporalmente no disponible" }, { status: 503 });
  }

  const parsed = QuerySchema.safeParse({
    servicioId: url.searchParams.get("servicioId") ?? undefined,
    slug: url.searchParams.get("slug") ?? undefined,
    desde: url.searchParams.get("desde") ?? undefined,
    hasta: url.searchParams.get("hasta") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const ahora = new Date();
  const desde = parsed.data.desde ? new Date(parsed.data.desde) : ahora;
  const hasta = parsed.data.hasta ? new Date(parsed.data.hasta) : new Date(ahora.getTime() + SEIS_SEMANAS_MS);

  // Tope de rango (deuda 2.2): nadie puede pedir una ventana arbitrariamente grande.
  if (hasta.getTime() - desde.getTime() > RANGO_MAX_MS) {
    return Response.json({ error: "Rango de fechas demasiado amplio (máximo 12 semanas)" }, { status: 400 });
  }

  // La UI trabaja con slugs; el backend filtra por id. Si llega slug lo resolvemos.
  let servicioId = parsed.data.servicioId;
  if (!servicioId && parsed.data.slug) {
    const servicio = await prisma.servicio.findUnique({ where: { slug: parsed.data.slug } });
    servicioId = servicio?.id;
  }

  // Bug 1.6: si pidieron por slug y este no resuelve a ningun servicio, devolver
  // vacio (nunca la lista completa sin filtrar).
  if (parsed.data.slug && !servicioId) {
    return Response.json({ clases: [] });
  }

  const clases = await prisma.clase.findMany({
    where: {
      cancelada: false,
      fecha: { gte: desde, lte: hasta },
      servicio: { activo: true },
      ...(servicioId ? { servicioId } : {}),
    },
    include: {
      servicio: true,
      _count: { select: { reservas: { where: { estado: "CONFIRMADA" } } } },
    },
    orderBy: { fecha: "asc" },
  });

  return Response.json({
    clases: clases.map((c) => ({
      id: c.id,
      servicioId: c.servicioId,
      servicioSlug: c.servicio.slug,
      fecha: c.fecha.toISOString(),
      cupoMax: c.cupoMax,
      cuposOcupados: c._count.reservas,
      cuposDisponibles: Math.max(0, c.cupoMax - c._count.reservas),
      lleno: c._count.reservas >= c.cupoMax,
    })),
  });
}