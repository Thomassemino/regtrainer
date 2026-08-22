export const money = (n: number) => "$" + n.toLocaleString("es-AR");

export const AC = "#9184d9";
export const ACD = "#2b2741";
export const DIV = "rgba(233,233,237,.16)";
export const SUR = "#232532";

export interface Servicio {
  id: string;
  nombre: string;
  tag: string;
  dur: string;
  precio: number;
  cupo: string;
  slot: string;
  foto: string;
  desc: string;
}

export const SERVICIOS: Servicio[] = [
  {
    id: "personal", nombre: "Personalizado 1 a 1", tag: "Estrella", dur: "60 min", precio: 22000, cupo: "3 horarios hoy", slot: "web-s-personal", foto: "Sesión 1 a 1",
    desc: "Una hora entera para vos: evaluación de movilidad, corrección técnica y progresión de cargas semana a semana. Ideal si arrancás de cero o venís de una lesión.",
  },
  {
    id: "funcional", nombre: "Funcional / HIIT", tag: "Grupal", dur: "50 min", precio: 12000, cupo: "2 lugares", slot: "web-s-funcional", foto: "Clase funcional",
    desc: "Circuitos de fuerza y cardio en grupos de hasta 8 personas. Cada bloque se adapta a tu nivel, así que entrenás al lado de alguien más avanzado sin quedarte atrás.",
  },
  {
    id: "musculacion", nombre: "Musculación", tag: "Fuerza", dur: "75 min", precio: 15000, cupo: "5 horarios", slot: "web-s-musculacion", foto: "Sala de pesas",
    desc: "Trabajo de fuerza planificado en bloques de cuatro semanas, con control de RPE y registro de cargas para que la progresión sea medible y no una sensación.",
  },
  {
    id: "outdoor", nombre: "Outdoor / Running", tag: "Aire libre", dur: "60 min", precio: 10000, cupo: "6 lugares", slot: "web-s-outdoor", foto: "Running en el parque",
    desc: "Series, fondo y técnica de carrera en los Bosques de Palermo, martes y jueves a las 7. Grupos separados por ritmo, desde 6:30 el kilómetro hasta bajar la marca en 10K.",
  },
  {
    id: "online", nombre: "Rutinas grabadas", tag: "Online", dur: "A tu ritmo", precio: 9000, cupo: "Acceso inmediato", slot: "web-s-online", foto: "Entrenamiento en casa",
    desc: "Biblioteca de más de 60 rutinas filmadas por Beto, organizadas por objetivo y equipamiento. Se actualiza todos los meses e incluye una videollamada de ajuste.",
  },
  {
    id: "evaluacion", nombre: "Evaluación inicial", tag: "Sin cargo", dur: "45 min", precio: 0, cupo: "Cupos esta semana", slot: "web-s-evaluacion", foto: "Evaluación funcional",
    desc: "Antropometría, movilidad, fuerza y una charla sobre tu objetivo real. Salís con un plan escrito, entrenes o no con Beto después.",
  },
];

export interface Pack {
  id: string;
  nombre: string;
  desc: string;
  precio: number;
  unit: string;
  badge: string;
  feats: string[];
  cta: string;
}

export const PACKS: Pack[] = [
  { id: "suelta", nombre: "Clase suelta", desc: "Probá sin compromiso, se paga al reservar.", precio: 12000, unit: "por clase", badge: "", feats: ["Sin vencimiento", "Cualquier disciplina"], cta: "Reservar" },
  { id: "bono4", nombre: "Bono 4 clases", desc: "Una clase por semana durante un mes.", precio: 43000, unit: "$10.750 por clase", badge: "", feats: ["Vence en 90 días", "Reprogramás sin costo"], cta: "Comprar bono" },
  { id: "bono8", nombre: "Bono 8 clases", desc: "El más elegido: dos clases por semana.", precio: 80000, unit: "$10.000 por clase", badge: "Más elegido", feats: ["Vence en 90 días", "Prioridad de cupo", "Transferible"], cta: "Comprar bono" },
  { id: "mensual", nombre: "Mensualidad", desc: "Todas las grupales + 1 personalizada por semana.", precio: 150000, unit: "por mes, se renueva solo", badge: "Suscripción", feats: ["Clases ilimitadas", "Cupo garantizado", "Plan nutricional", "Cancelás cuando quieras"], cta: "Suscribirme" },
];

export interface Hora {
  hora: string;
  cupos: string;
  lleno: boolean;
}

export const HORAS: Hora[] = [
  { hora: "07:00", cupos: "2 lugares", lleno: false }, { hora: "08:00", cupos: "Completo", lleno: true },
  { hora: "09:00", cupos: "4 lugares", lleno: false }, { hora: "10:00", cupos: "1 lugar", lleno: false },
  { hora: "12:00", cupos: "Completo", lleno: true }, { hora: "17:00", cupos: "5 lugares", lleno: false },
  { hora: "18:00", cupos: "3 lugares", lleno: false }, { hora: "19:00", cupos: "2 lugares", lleno: false },
  { hora: "20:00", cupos: "6 lugares", lleno: false }, { hora: "21:00", cupos: "4 lugares", lleno: false },
];

export const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const U = (id: string, w?: number) => "https://images.unsplash.com/photo-" + id + "?fm=jpg&q=70&w=" + (w || 1200) + "&auto=format&fit=crop";

export const PH: Record<string, { src: string; credit: string; href: string }> = {
  hero: { src: U("1526506118085-60ce8714f8c5", 1400), credit: "Edgar Chaparro / Unsplash", href: "https://unsplash.com/@echaparro" },
  personal: { src: U("1676655079738-af54dfd6318e", 900), credit: "Brendan Stephens / Unsplash", href: "https://unsplash.com/@brendan_stephens" },
  funcional: { src: U("1599058917212-d750089bc07e", 900), credit: "Karsten Winegeart / Unsplash", href: "https://unsplash.com/@_karsten" },
  musculacion: { src: U("1689877020200-403d8542d95d", 900), credit: "Ambitious Studio / Unsplash", href: "https://unsplash.com/@weareambitious" },
  outdoor: { src: U("1651840403916-d1e0515b32c4", 900), credit: "Ambitious Studio / Unsplash", href: "https://unsplash.com/@weareambitious" },
  online: { src: U("1672344048213-76b6e77304bd", 900), credit: "Paweł Bulwan / Unsplash", href: "https://unsplash.com/@pbulwan" },
  evaluacion: { src: U("1590487988256-9ed24133863e", 900), credit: "Brett Jordan / Unsplash", href: "https://unsplash.com/@brett_jordan" },
  g1: { src: U("1778828494354-9b717d36dc99", 1400), credit: "Salman Sidheek / Unsplash", href: "https://unsplash.com/@salman_sidheek" },
  g2: { src: U("1637430308606-86576d8fef3c", 900), credit: "Mohamed Fareed / Unsplash", href: "https://unsplash.com/@livesbro" },
  g3: { src: U("1637870473618-8c9fa7d11f0a", 900), credit: "Mohamed Fareed / Unsplash", href: "https://unsplash.com/@livesbro" },
  g4: { src: U("1734630341082-0fec0e10126c", 900), credit: "Jason Grant / Unsplash", href: "https://unsplash.com/@jgrant1" },
  g5: { src: U("1648235692910-947cb90ddd97", 900), credit: "Mohamed Fareed / Unsplash", href: "https://unsplash.com/@livesbro" },
  p1: { src: U("1504805572947-34fad45aed93", 900), credit: "Clark Tibbs / Unsplash", href: "https://unsplash.com/@clarktibbs" },
  p2: { src: U("1590487988256-9ed24133863e", 900), credit: "Brett Jordan / Unsplash", href: "https://unsplash.com/@brett_jordan" },
  p3: { src: U("1637870473618-8c9fa7d11f0a", 900), credit: "Mohamed Fareed / Unsplash", href: "https://unsplash.com/@livesbro" },
  retrato: { src: U("1676655079738-af54dfd6318e", 900), credit: "Brendan Stephens / Unsplash", href: "https://unsplash.com/@brendan_stephens" },
};

export interface EjercicioDef {
  n: string;
  d: string;
}

export const RUTINA: Record<number, EjercicioDef[]> = {
  0: [{ n: "Sentadilla trasera", d: "4 × 6 · 60 kg · RPE 8" }, { n: "Press banca", d: "4 × 8 · 40 kg" }, { n: "Remo con barra", d: "3 × 10 · 35 kg" }, { n: "Plancha lateral", d: "3 × 40 s por lado" }, { n: "Movilidad de cadera", d: "6 min al final" }],
  1: [{ n: "Peso muerto rumano", d: "4 × 8 · 55 kg" }, { n: "Dominadas asistidas", d: "4 × 6" }, { n: "Zancadas caminando", d: "3 × 12 por pierna" }, { n: "Face pull", d: "3 × 15" }],
  2: [{ n: "Trote continuo", d: "25 min ritmo 6:10" }, { n: "Series 400 m", d: "6 × 400 · pausa 90 s" }, { n: "Elongación guiada", d: "8 min" }],
  3: [{ n: "Circuito HIIT", d: "5 vueltas · 40/20" }, { n: "Kettlebell swing", d: "4 × 15 · 16 kg" }, { n: "Burpees", d: "4 × 10" }, { n: "Core en suspensión", d: "3 × 12" }],
};
