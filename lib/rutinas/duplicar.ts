import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function duplicarDia(tx: Tx, origenDiaId: string, destinoDiaId: string): Promise<void> {
  const origen = await tx.diaPrograma.findUniqueOrThrow({
    where: { id: origenDiaId },
    include: { bloques: { orderBy: { orden: "asc" }, include: { sobrecarga: true } } },
  });

  await tx.bloque.deleteMany({ where: { diaId: destinoDiaId } });

  for (const bloque of origen.bloques) {
    await tx.bloque.create({
      data: {
        diaId: destinoDiaId,
        orden: bloque.orden,
        tipo: bloque.tipo,
        foco: bloque.foco,
        titulo: bloque.titulo,
        detalle: bloque.detalle,
        meta: bloque.meta,
        sobrecarga: {
          create: bloque.sobrecarga.map((f) => ({ semana: f.semana, series: f.series, reps: f.reps, pct: f.pct, descanso: f.descanso })),
        },
      },
    });
  }
}

export async function duplicarPrograma(tx: Tx, programaId: string, creadoPorId: string): Promise<string> {
  const original = await tx.programa.findUniqueOrThrow({
    where: { id: programaId },
    include: { dias: { include: { bloques: { include: { sobrecarga: true } } } } },
  });

  const copia = await tx.programa.create({
    data: {
      nombre: `${original.nombre} (copia)`,
      semanas: original.semanas,
      objetivo: original.objetivo,
      frecuencia: original.frecuencia,
      estado: "BORRADOR",
      creadoPorId,
    },
  });

  for (const dia of original.dias) {
    const diaCopia = await tx.diaPrograma.create({
      data: {
        programaId: copia.id,
        diaSemana: dia.diaSemana,
        descanso: dia.descanso,
        calentamiento: dia.calentamiento,
      },
    });
    for (const bloque of dia.bloques) {
      await tx.bloque.create({
        data: {
          diaId: diaCopia.id,
          orden: bloque.orden,
          tipo: bloque.tipo,
          foco: bloque.foco,
          titulo: bloque.titulo,
          detalle: bloque.detalle,
          meta: bloque.meta,
          sobrecarga: {
            create: bloque.sobrecarga.map((f) => ({ semana: f.semana, series: f.series, reps: f.reps, pct: f.pct, descanso: f.descanso })),
          },
        },
      });
    }
  }

  return copia.id;
}