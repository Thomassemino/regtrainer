export type Screen = "landing" | "reservar" | "checkout" | "confirm" | "login" | "cuenta" | "coach";
export type CuentaTab = "reservas" | "rutina" | "paquetes" | "notis" | "datos";
export type Metodo = "bono" | "tarjeta" | "mp" | "efectivo";
export type LoginRol = "cliente" | "admin";

export interface AppState {
  screen: Screen;
  cuentaTab: CuentaTab;
  prev: Screen[];
  servicio: string;
  dia: number;
  hora: string | null;
  recurrente: boolean;
  metodo: Metodo;
  cuota: number;
  creditos: number;
  packSel: string | null;
  rutinaDia: number;
  hechos: Record<string, boolean>;
  toast: string | null;
  loginRolUI: LoginRol;
}