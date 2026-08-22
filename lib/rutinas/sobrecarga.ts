import { pctParaSemana, repsParaSemana } from "./progresion";

export interface BaseSobrecarga {
  series: number;
  descanso: string;
}

export interface FilaSobrecargaInput {
  semana: number;
  series: number;
  reps: number;
  pct: number;
  descanso: string;
}

export function construirFilaSobrecarga(semana: number, base: BaseSobrecarga): FilaSobrecargaInput {
  return {
    semana,
    series: base.series,
    reps: repsParaSemana(semana),
    pct: pctParaSemana(semana),
    descanso: base.descanso,
  };
}

export function construirTablaSobrecarga(totalSemanas: number, base: BaseSobrecarga): FilaSobrecargaInput[] {
  return Array.from({ length: totalSemanas }, (_, i) => construirFilaSobrecarga(i + 1, base));
}