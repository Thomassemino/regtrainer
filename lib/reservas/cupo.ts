export function calcularEstadoReserva(
  confirmadas: number,
  cupoMax: number
): "CONFIRMADA" | "LISTA_ESPERA" {
  return confirmadas < cupoMax ? "CONFIRMADA" : "LISTA_ESPERA";
}