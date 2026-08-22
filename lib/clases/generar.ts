import { prisma } from "../db";

const VENTANA_SEMANAS = 6;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MS_MARGEN_COBERTURA = 20 * 60 * 60 * 1000;

export async function ensureClasesGeneradas(now: Date = new Date()): Promise<void> {
  const horarios = await prisma.horarioRecurrente.findMany({
    where: { activo: true, servicio: { activo: true } },
    include: { servicio: true },
  });

  const finVentana = new Date(now.getTime() + VENTANA_SEMANAS * 7 * MS_POR_DIA);

  for (const horario of horarios) {
    const ultimaGenerada = await prisma.clase.findFirst({
      where: { servicioId: horario.servicioId },
      orderBy: { fecha: "desc" },
      select: { fecha: true },
    });

    const yaCubierta =
      ultimaGenerada != null &&
      ultimaGenerada.fecha.getTime() >= finVentana.getTime() - MS_MARGEN_COBERTURA;
    if (yaCubierta) continue;

    await generarInstanciasParaHorario(horario, now, finVentana);
  }
}

async function generarInstanciasParaHorario(
  horario: { servicioId: string; diaSemana: number; horaInicio: string; servicio: { cupoMax: number } },
  desde: Date,
  hasta: Date
): Promise<void> {
  const [horasStr, minutosStr] = horario.horaInicio.split(":");
  const horas = Number(horasStr);
  const minutos = Number(minutosStr);

  const cursor = new Date(desde);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() <= hasta.getTime()) {
    if (cursor.getUTCDay() === horario.diaSemana) {
      const fecha = new Date(cursor);
      fecha.setUTCHours(horas, minutos, 0, 0);
      if (fecha.getTime() >= desde.getTime()) {
        await prisma.clase.upsert({
          where: { servicioId_fecha: { servicioId: horario.servicioId, fecha } },
          update: {},
          create: {
            servicioId: horario.servicioId,
            fecha,
            cupoMax: horario.servicio.cupoMax,
          },
        });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}