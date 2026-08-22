import type { PrismaClient } from "@prisma/client";

export function calcularPorcentajeCumplimiento(completados: number, totalBloques: number): number {
  if (totalBloques <= 0) return 0;
  return Math.round((completados / totalBloques) * 100);
}

export interface CumplimientoSemana {
  semana: number;
  porcentaje: number;
}

export async function calcularCumplimientoUltimasSemanas(
  prisma: PrismaClient,
  asignacionId: string,
  semanaMaxima: number,
  cantidad = 4,
): Promise<CumplimientoSemana[]> {
  const asignacion = await prisma.asignacionPrograma.findUniqueOrThrow({
    where: { id: asignacionId },
    include: { programa: { include: { dias: { include: { bloques: true } } } } },
  });
  const totalBloques = asignacion.programa.dias.reduce((acc, d) => acc + d.bloques.length, 0);

  const desde = Math.max(1, semanaMaxima - cantidad + 1);
  const semanas = Array.from({ length: semanaMaxima - desde + 1 }, (_, i) => desde + i);

  const resultados: CumplimientoSemana[] = [];
  for (const semana of semanas) {
    const completados = await prisma.bloqueCompletado.count({ where: { asignacionId, semana } });
    resultados.push({ semana, porcentaje: calcularPorcentajeCumplimiento(completados, totalBloques) });
  }
  return resultados;
}