const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000;

// Semanas completas transcurridas desde que se asignó el programa, acotado a [1, semanasDelPrograma]
// — así un programa recién asignado da semana 1, y uno vencido no se sale del rango del mesociclo.
export function calcularSemanaActual(asignadoEnIso: string | Date, semanasDelPrograma: number): number {
  const asignadoEn = typeof asignadoEnIso === "string" ? new Date(asignadoEnIso) : asignadoEnIso;
  const transcurridas = Math.floor((Date.now() - asignadoEn.getTime()) / MS_POR_SEMANA);
  return Math.min(Math.max(transcurridas + 1, 1), semanasDelPrograma);
}
