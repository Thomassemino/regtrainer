export type Screen =
  | "landing" | "reservar" | "checkout" | "confirm" | "login" | "cuenta" | "coach"
  | "clientes" | "ficha" | "builder" | "asignar" | "pdf";
export type CuentaTab = "reservas" | "rutina" | "paquetes" | "notis" | "datos";
export type Metodo = "bono" | "tarjeta" | "mp" | "efectivo";
export type LoginRol = "cliente" | "admin";

export type TipoBloque = "TRADICIONAL" | "SECUENCIA" | "SUPERSERIE" | "EMOM" | "POR_TIEMPO";
export type FocoBloque = "TECNICA" | "RITMO" | "MAXIMO_ESFUERZO";
export type TemaPdf = "clean" | "night" | "pink";
export type EstadoPrograma = "BORRADOR" | "ASIGNADO" | "COMPLETADO" | "ARCHIVADO";

export interface FilaSobrecargaApi {
  semana: number;
  series: number;
  reps: number;
  pct: number;
  descanso: string;
}

export interface BloqueApi {
  id: string;
  diaId: string;
  orden: number;
  tipo: TipoBloque;
  foco: FocoBloque;
  titulo: string;
  detalle: string;
  meta: string | null;
  sobrecarga: FilaSobrecargaApi[];
}

export interface DiaProgramaApi {
  id: string;
  programaId: string;
  diaSemana: number;
  descanso: boolean;
  calentamiento: string | null;
  bloques: BloqueApi[];
}

export interface ProgramaApi {
  id: string;
  nombre: string;
  semanas: number;
  objetivo: string;
  frecuencia: string;
  estado: EstadoPrograma;
  dias: DiaProgramaApi[];
}

export interface ClienteFilaApi {
  id: string;
  nombre: string;
  iniciales: string;
  objetivo: string;
  plan: string;
  programaActual: string;
  programaEstado: EstadoPrograma | null;
  actualizadoEn: string | null;
}

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
  toast: string | null;
  loginRolUI: LoginRol;

  // Panel de rutinas (spec 2026-08-22-panel-rutinas-design.md)
  fichaId: string | null;
  programaIdActivo: string | null;
  semanaSel: number;
  editorOpen: boolean;
  editorDiaId: string | null;
  editorBloqueId: string | null;
  diaClienteSel: number;
  asignadosSel: Record<string, boolean>;
  temaPdfSel: TemaPdf;
}