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

  // Una sola lectura por request en vez de 1 query por horario (N+1).
  const serviciosIds = [...new Set(horarios.map((h) => h.servicioId))];
  const clasesExistentes = await prisma.clase.findMany({
    where: { servicioId: { in: serviciosIds }, fecha: { gte: now } },
    select: { servicioId: true, fecha: true },
  });

  const keyDeHorario = (fecha: Date) => `${fecha.getUTCDay()}-${fecha.getUTCHours()}:${fecha.getUTCMinutes()}`;

  for (const horario of horarios) {
    const key = `${horario.diaSemana}-${horario.horaInicio}`;
    const ultimaDeEseHorario = clasesExistentes
      .filter((c) => c.servicioId === horario.servicioId && keyDeHorario(c.fecha) === key)
      .reduce<Date | null>((max, c) => (max === null || c.fecha > max ? c.fecha : max), null);

    // Cobertura POR horario (no por servicio): un horario nuevo/recién activado
    // no puede quedar invisible porque otro horario del mismo servicio ya cubrió.
    const yaCubierta =
      ultimaDeEseHorario !== null && ultimaDeEseHorario.getTime() >= finVentana.getTime() - MS_MARGEN_COBERTURA;

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
          // Si Beto cambió el cupoMax del servicio dentro de la ventana, lo propago
          // a las instancias ya generadas (en vez de update:{}).
          update: { cupoMax: horario.servicio.cupoMax },
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