import { pctParaSemana, repsParaSemana } from "./progresion";

export interface BaseSobrecarga {
  series: number;
  descanso: string;
  reps?: number;
  pct?: number;
}

export interface FilaSobrecargaInput {
  semana: number;
  series: number;
  reps: number;
  pct: number;
  descanso: string;
}

// reps/pct siguen el ciclo de progresión (progresion.ts) pero desplazado para
// arrancar en la base que eligió el coach en la semana 1, en vez de siempre
// arrancar en el valor fijo del ciclo.
export function construirFilaSobrecarga(semana: number, base: BaseSobrecarga): FilaSobrecargaInput {
  const repsBase = base.reps ?? repsParaSemana(1);
  const pctBase = base.pct ?? pctParaSemana(1);
  return {
    semana,
    series: base.series,
    reps: repsBase + (repsParaSemana(semana) - repsParaSemana(1)),
    pct: pctBase + (pctParaSemana(semana) - pctParaSemana(1)),
    descanso: base.descanso,
  };
}

export function construirTablaSobrecarga(totalSemanas: number, base: BaseSobrecarga): FilaSobrecargaInput[] {
  return Array.from({ length: totalSemanas }, (_, i) => construirFilaSobrecarga(i + 1, base));
}