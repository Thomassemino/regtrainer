export const INTENSIDAD_CICLO = [70, 75, 80, 65, 72, 78, 82, 68] as const;
export const REPS_CICLO = [6, 5, 4, 5] as const;

export function pctParaSemana(semana: number): number {
  return INTENSIDAD_CICLO[(semana - 1) % INTENSIDAD_CICLO.length];
}

export function repsParaSemana(semana: number): number {
  return REPS_CICLO[(semana - 1) % REPS_CICLO.length];
}