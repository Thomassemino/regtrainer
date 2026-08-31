import { prisma } from "../db";
import { centavosAPesos } from "../dinero";

const RUTINA_DESACTUALIZADA_DIAS = 21;
const MENSUALIDAD_PRONTO_A_VENCER_DIAS = 7;

function inicioDeSemana(base: Date): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const desdeLunes = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - desdeLunes);
  return d;
}

function inicioDeMes(base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth(), 1);
}

export async function obtenerKpis() {
  const ahora = new Date();
  const inicioMes = inicioDeMes(ahora);
  const inicioMesAnterior = new Date(inicioMes.getFullYear(), inicioMes.getMonth() - 1, 1);
  const inicioSemana = inicioDeSemana(ahora);
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(finSemana.getDate() + 7);
  const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const haceUmbralRutina = new Date(ahora.getTime() - RUTINA_DESACTUALIZADA_DIAS * 24 * 60 * 60 * 1000);

  const [ingresosMes, ingresosMesAnterior, clases, clientesActivosIds, clientesNuevos, clientesConAsignacion] = await Promise.all([
    prisma.pago.aggregate({ _sum: { monto: true }, where: { estado: "APROBADO", creadoEn: { gte: inicioMes } } }),
    prisma.pago.aggregate({ _sum: { monto: true }, where: { estado: "APROBADO", creadoEn: { gte: inicioMesAnterior, lt: inicioMes } } }),
    prisma.clase.findMany({
      where: { cancelada: false, fecha: { gte: inicioSemana, lt: finSemana } },
      include: { reservas: { where: { estado: "CONFIRMADA" } } },
    }),
    prisma.reserva.findMany({ where: { estado: "CONFIRMADA", creadaEn: { gte: hace30Dias } }, select: { clienteId: true }, distinct: ["clienteId"] }),
    prisma.cliente.count({ where: { createdAt: { gte: hace30Dias } } }),
    prisma.cliente.findMany({
      include: { asignaciones: { orderBy: { asignadoEn: "desc" }, take: 1 } },
    }),
  ]);

  const suscripcionesActivas = await prisma.suscripcion.findMany({ where: { estado: "ACTIVA" }, select: { clienteId: true } });
  const clientesActivosSet = new Set([...clientesActivosIds.map((r) => r.clienteId), ...suscripcionesActivas.map((s) => s.clienteId)]);

  const cupoTotal = clases.reduce((acc, c) => acc + c.cupoMax, 0);
  const cupoOcupado = clases.reduce((acc, c) => acc + c.reservas.length, 0);
  const ocupacionSemana = cupoTotal > 0 ? Math.round((cupoOcupado / cupoTotal) * 100) : 0;

  const rutinasSinActualizar = clientesConAsignacion.filter((c) => {
    const ultima = c.asignaciones[0];
    return ultima && ultima.asignadoEn < haceUmbralRutina;
  }).length;

  const montoMes = centavosAPesos(ingresosMes._sum.monto ?? 0);
  const montoMesAnterior = centavosAPesos(ingresosMesAnterior._sum.monto ?? 0);
  const deltaIngresos = montoMesAnterior > 0 ? Math.round(((montoMes - montoMesAnterior) / montoMesAnterior) * 100) : null;

  return {
    ingresosMes: montoMes,
    deltaIngresosTexto: deltaIngresos === null ? "Sin datos del mes anterior" : `${deltaIngresos >= 0 ? "+" : ""}${deltaIngresos}% vs mes anterior`,
    clasesEstaSemana: clases.length,
    ocupacionSemanaTexto: `${ocupacionSemana}% de ocupación`,
    clientesActivos: clientesActivosSet.size,
    clientesNuevosTexto: `+${clientesNuevos} nuevos`,
    rutinasSinActualizar,
  };
}

export async function obtenerAgendaDeHoy() {
  const ahora = new Date();
  const inicioHoy = new Date(ahora);
  inicioHoy.setHours(0, 0, 0, 0);
  const finHoy = new Date(inicioHoy);
  finHoy.setDate(finHoy.getDate() + 1);

  const clases = await prisma.clase.findMany({
    where: { cancelada: false, fecha: { gte: inicioHoy, lt: finHoy } },
    include: { servicio: true, reservas: true },
    orderBy: { fecha: "asc" },
  });

  return clases.map((c) => {
    const confirmadas = c.reservas.filter((r) => r.estado === "CONFIRMADA").length;
    const espera = c.reservas.filter((r) => r.estado === "LISTA_ESPERA").length;
    const fin = new Date(c.fecha.getTime() + c.servicio.duracionMin * 60 * 1000);
    let estado: string;
    let tagClass: string;
    if (fin < ahora) {
      estado = "Cerrada";
      tagClass = "tag-neutral";
    } else if (c.fecha <= ahora && ahora <= fin) {
      estado = "En curso";
      tagClass = "tag-accent";
    } else if (confirmadas >= c.cupoMax) {
      estado = espera > 0 ? `Completa` : "Completa";
      tagClass = "tag-accent";
    } else {
      estado = "Cupo libre";
      tagClass = "tag-outline";
    }
    return {
      id: c.id,
      hora: c.fecha.toISOString().slice(11, 16),
      clase: c.servicio.nombre,
      gente: espera > 0 ? `${confirmadas} de ${c.cupoMax} anotados · ${espera} en lista de espera` : `${confirmadas} de ${c.cupoMax} anotados`,
      estado,
      tagClass,
    };
  });
}

export async function obtenerOcupacionSemana() {
  const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const ahora = new Date();
  const inicioSemana = inicioDeSemana(ahora);

  const resultado: { dia: string; pct: string; ocupacion: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const inicioDia = new Date(inicioSemana);
    inicioDia.setDate(inicioDia.getDate() + i);
    const finDia = new Date(inicioDia);
    finDia.setDate(finDia.getDate() + 1);

    const clases = await prisma.clase.findMany({
      where: { cancelada: false, fecha: { gte: inicioDia, lt: finDia } },
      include: { reservas: { where: { estado: "CONFIRMADA" } } },
    });
    const cupoTotal = clases.reduce((acc, c) => acc + c.cupoMax, 0);
    const cupoOcupado = clases.reduce((acc, c) => acc + c.reservas.length, 0);
    const pct = cupoTotal > 0 ? Math.round((cupoOcupado / cupoTotal) * 100) : 0;
    resultado.push({ dia: DIAS_CORTOS[inicioDia.getDay()], pct: `${pct}%`, ocupacion: pct });
  }
  return resultado;
}

export async function obtenerClientesQueNecesitanAtencion() {
  const ahora = new Date();
  const en7Dias = new Date(ahora.getTime() + MENSUALIDAD_PRONTO_A_VENCER_DIAS * 24 * 60 * 60 * 1000);
  const haceUmbralRutina = new Date(ahora.getTime() - RUTINA_DESACTUALIZADA_DIAS * 24 * 60 * 60 * 1000);
  const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

  const items: { id: string; nombre: string; iniciales: string; motivo: string; cta: string }[] = [];

  const mensualidadesPorVencer = await prisma.suscripcion.findMany({
    where: { estado: "ACTIVA", fechaProximoCobro: { lte: en7Dias, gte: ahora } },
    include: { cliente: true },
  });
  for (const s of mensualidadesPorVencer) {
    const dias = Math.max(0, Math.ceil((s.fechaProximoCobro.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000)));
    items.push({ id: s.cliente.id, nombre: s.cliente.nombre, iniciales: s.cliente.iniciales, motivo: `Mensualidad vence en ${dias} día${dias === 1 ? "" : "s"}`, cta: "Avisar" });
  }

  const clientes = await prisma.cliente.findMany({
    include: {
      asignaciones: { orderBy: { asignadoEn: "desc" }, take: 1 },
      reservas: { where: { estado: "NO_ASISTIO", creadaEn: { gte: hace30Dias } } },
    },
  });
  for (const c of clientes) {
    if (items.some((i) => i.id === c.id)) continue;
    const ultima = c.asignaciones[0];
    if (ultima && ultima.asignadoEn < haceUmbralRutina) {
      const semanas = Math.floor((ahora.getTime() - ultima.asignadoEn.getTime()) / (7 * 24 * 60 * 60 * 1000));
      items.push({ id: c.id, nombre: c.nombre, iniciales: c.iniciales, motivo: `Rutina sin actualizar hace ${semanas} semana${semanas === 1 ? "" : "s"}`, cta: "Asignar" });
      continue;
    }
    if (c.reservas.length >= 2) {
      items.push({ id: c.id, nombre: c.nombre, iniciales: c.iniciales, motivo: `Faltó a las últimas ${c.reservas.length} clases`, cta: "Escribir" });
      continue;
    }
    if (c.plan === "Evaluación inicial" && c.asignaciones.length === 0) {
      items.push({ id: c.id, nombre: c.nombre, iniciales: c.iniciales, motivo: "Evaluación inicial sin plan cargado", cta: "Cargar" });
    }
  }

  return items.slice(0, 6);
}
