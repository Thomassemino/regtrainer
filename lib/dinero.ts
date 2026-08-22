export function pesosACentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function centavosAPesos(centavos: number): number {
  return Math.round(centavos / 100);
}