"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
import { AC, ACD, DIV, DOW, HORAS, PACKS, PH, RUTINA, SERVICIOS, SUR, money } from "@/lib/data";
import type { AppState, Screen } from "@/lib/types";

const initialState: AppState = {
  screen: "landing", cuentaTab: "reservas", prev: [],
  servicio: "funcional", dia: 2, hora: null, recurrente: false,
  metodo: "bono", cuota: 1, creditos: 6, packSel: null,
  rutinaDia: 0, hechos: {}, toast: null,
  loginRolUI: "cliente",
};

function diasData() {
  const base = new Date(2026, 7, 17);
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return { i, dow: DOW[d.getDay()], num: d.getDate(), libre: d.getDay() !== 0 };
  });
}

function svc(id: string) {
  return SERVICIOS.find((s) => s.id === id) || SERVICIOS[1];
}

const sel = (on: boolean) => ({
  bg: on ? "rgba(145,132,217,.16)" : "transparent",
  bd: on ? AC : DIV,
  fg: on ? "#d2cefd" : "#e9e9ed",
});

export function useBetoApp() {
  const { data: session, status } = useSession();
  const [state, setState] = useState<AppState>(initialState);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const set = useCallback((updater: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => {
    setState((s) => ({ ...s, ...(typeof updater === "function" ? updater(s) : updater) }));
  }, []);

  const go = useCallback((screen: Screen) => {
    setState((s) => ({ ...s, screen, prev: [...s.prev, s.screen] }));
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => {
    setState((s) => {
      const prev = [...s.prev];
      const last = (prev.pop() as Screen) || "landing";
      return { ...s, screen: last, prev };
    });
  }, []);

  const showToast = useCallback((t: string) => {
    set({ toast: t });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => set({ toast: null }), 2400);
  }, [set]);

  const st = state;
  const s = svc(st.servicio);
  const dias = diasData();
  const diaSel = dias[st.dia];
  const packSel = PACKS.find((p) => p.id === st.packSel) ?? null;
  const total = packSel ? packSel.precio : st.metodo === "bono" ? 0 : s.precio;

  const auth = session?.user?.role ?? null;
  const esCliente = auth === "CLIENTE";
  const esAdmin = auth === "ADMIN";

  const ejercicios = (RUTINA[st.rutinaDia] || []).map((e, i) => {
    const key = st.rutinaDia + "-" + i;
    const on = !!st.hechos[key];
    return {
      nombre: e.n, detalle: e.d, deco: on ? "line-through" : "none",
      chkBd: on ? AC : DIV, chkBg: on ? AC : "transparent", chkFg: on ? "#161826" : "transparent",
      onToggle: () => set((p) => ({ hechos: { ...p.hechos, [key]: !p.hechos[key] } })),
    };
  });

  const goTab = (t: AppState["cuentaTab"]) => () => set({ cuentaTab: t, screen: "cuenta" });

  const entrar = async (email: string, password: string) => {
    const result = await nextAuthSignIn("credentials", { email, password, redirect: false });
    if (!result || result.error) {
      return;
    }
    go(st.loginRolUI === "admin" ? "coach" : "cuenta");
    showToast(st.loginRolUI === "admin" ? "Bienvenido, Beto" : "Hola de nuevo");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await nextAuthSignOut({ redirect: false });
    go("landing");
    showToast("Sesión cerrada");
  };

  const goCoach = () => {
    if (auth === "ADMIN") {
      go("coach");
      return;
    }
    set({ loginRolUI: "admin" });
    go("login");
  };

  const vals = {
    isLanding: st.screen === "landing", isReservar: st.screen === "reservar", isCheckout: st.screen === "checkout",
    isConfirm: st.screen === "confirm", isCuenta: st.screen === "cuenta", isCoach: st.screen === "coach",
    isLogin: st.screen === "login",
    esCliente, esAdmin,
    cuentaLabel: auth ? "Mi cuenta" : "Ingresar",
    logoutShow: auth ? "inline-flex" : "none",
    logout,
    loginTitulo: st.loginRolUI === "admin" ? "Panel del entrenador" : "Entrá a tu cuenta",
    loginBajada: st.loginRolUI === "admin"
      ? "Acceso exclusivo de Beto: agenda del día, clientes, bonos por vencer, cobros y asignación de rutinas."
      : "Tus reservas, tu rutina, tus bonos y tus pagos en un solo lugar. Si ya compraste una clase, ya tenés cuenta.",
    loginBullets: (st.loginRolUI === "admin"
      ? [{ icon: "ph-calendar-check", t: "Agenda del día con cupos y lista de espera" }, { icon: "ph-users-three", t: "Ficha de cada cliente, rutinas y asistencias" }, { icon: "ph-chart-line-up", t: "Ingresos, ocupación y bonos por vencer" }]
      : [{ icon: "ph-ticket", t: "Reservás y usás los créditos de tu bono" }, { icon: "ph-barbell", t: "Ves la rutina que te asignó Beto" }, { icon: "ph-receipt", t: "Historial de pagos y comprobantes" }]),
    rolTabs: [
      { id: "cliente", label: "Soy cliente", icon: "ph-user" },
      { id: "admin", label: "Soy el entrenador", icon: "ph-shield-check" },
    ].map((r) => {
      const on = st.loginRolUI === r.id;
      return {
        label: r.label, icon: r.icon, bg: on ? "rgba(145,132,217,.14)" : "transparent",
        fg: on ? "#d2cefd" : "rgba(233,233,237,.7)", sh: on ? "inset 0 0 0 1px " + AC : "none",
        onClick: () => set({ loginRolUI: r.id as "cliente" | "admin" }),
      };
    }),
    loginError: "",
    errorShow: "none",
    setLoginError: () => {},
    loginCta: st.loginRolUI === "admin" ? "Entrar al panel" : "Ingresar",
    loginNota: st.loginRolUI === "admin"
      ? "Acceso exclusivo del entrenador."
      : "Si no tenés cuenta, podés crearla en 1 minuto.",
    entrar,
    tabReservas: st.screen === "cuenta" && st.cuentaTab === "reservas",
    tabRutina: st.screen === "cuenta" && st.cuentaTab === "rutina",
    tabPaquetes: st.screen === "cuenta" && st.cuentaTab === "paquetes",
    tabDatos: st.screen === "cuenta" && st.cuentaTab === "datos",
    tabNotis: st.screen === "cuenta" && st.cuentaTab === "notis",

    back,
    goLanding: () => go("landing"), goReservar: () => go("reservar"),
    goCuenta: () => go(auth ? "cuenta" : "login"),
    goCoach,
    goPrecios: () => { go("landing"); showToast("Elegí un paquete en la sección Precios"); },

    navLinks: [
      { label: "Inicio", href: "#", onClick: () => go("landing") },
      { label: "Servicios", href: "#servicios", onClick: () => set({ screen: "landing" }) },
      { label: "Precios", href: "#precios", onClick: () => set({ screen: "landing" }) },
      { label: "Sobre Beto", href: "#beto", onClick: () => set({ screen: "landing" }) },
      { label: "Galería", href: "#galeria", onClick: () => set({ screen: "landing" }) },
      { label: "Blog", href: "#blog", onClick: () => set({ screen: "landing" }) },
    ].map((n) => ({ ...n, fg: "rgba(233,233,237,.75)" })),

    heroStats: [{ v: "340+", k: "Personas entrenadas" }, { v: "12", k: "Años de experiencia" }, { v: "4,9", k: "Puntaje promedio" }],
    bandas: [
      { icon: "ph-calendar-check", t: "Reservás online", d: "Elegís día y horario, con cupos en tiempo real." },
      { icon: "ph-credit-card", t: "Pagás en la web", d: "Tarjeta en cuotas, Mercado Pago o efectivo en el estudio." },
      { icon: "ph-ticket", t: "Bonos y mensualidad", d: "Comprás varias clases y las usás cuando quieras." },
      { icon: "ph-users-three", t: "Grupos de hasta 8", d: "Corrección técnica personalizada en cada clase." },
    ],
    servicios: SERVICIOS.map((x) => ({
      ...x, precioFmt: x.precio === 0 ? "Sin cargo" : money(x.precio),
      src: PH[x.id].src, credit: PH[x.id].credit, creditHref: PH[x.id].href,
      onClick: () => { set({ servicio: x.id === "evaluacion" ? "personal" : x.id }); go("reservar"); },
    })),
    pasos: [
      { n: "01", t: "Elegí la clase", d: "Personalizada, grupal, outdoor u online." },
      { n: "02", t: "Reservá el turno", d: "Día y horario con cupo confirmado al instante." },
      { n: "03", t: "Pagá como quieras", d: "Crédito de bono, tarjeta, Mercado Pago o efectivo." },
      { n: "04", t: "Entrená y seguí tu plan", d: "Tu rutina y tu progreso quedan en tu cuenta." },
    ],
    packs: PACKS.map((p) => ({
      ...p, precioFmt: money(p.precio), feats: p.feats.map((f) => ({ t: f })), badgeShow: p.badge ? "inline-flex" : "none",
      bd: p.id === "bono8" ? AC : DIV, bg: p.id === "bono8" ? "linear-gradient(150deg," + ACD + "," + SUR + ")" : "transparent",
      onClick: () => { set({ packSel: p.id, metodo: "tarjeta" }); go(p.id === "suelta" ? "reservar" : "checkout"); },
    })),
    coachStats: [{ v: "12", k: "Años entrenando" }, { v: "340+", k: "Alumnos" }, { v: "4,9", k: "Reseñas" }],
    certs: ["Prof. Ed. Física UNLP", "NSCA-CPT", "Entrenamiento funcional", "RCP y primeros auxilios", "Running coach nivel 2"].map((t) => ({ t })),
    testimonios: [
      { slot: "web-t1", estrellas: "★★★★★", texto: "«En cuatro meses volví a correr sin dolor de rodilla. Beto te corrige todo, no te deja pasar una repetición mal hecha.»", autor: "Julieta R. · Outdoor, 8 meses" },
      { slot: "web-t2", estrellas: "★★★★★", texto: "«Arranqué sin haber pisado un gimnasio nunca. Nadie te mira raro y el plan se ajusta a lo que podés hacer hoy.»", autor: "Martín D. · Personalizado, 1 año" },
      { slot: "web-t3", estrellas: "★★★★★", texto: "«Bajé 11 kg en un año, pero lo mejor es que ahora entreno porque quiero, no porque me obligo.»", autor: "Nicolás P. · Musculación, 14 meses" },
    ],
    posts: [
      { slot: "web-p1", cat: "Hábitos", titulo: "Cómo no abandonar en la semana 3", bajada: "La constancia no es motivación: es diseñar la semana para que entrenar sea inevitable.", meta: "5 min de lectura · 12/08/2026", src: PH.p1.src, credit: PH.p1.credit, creditHref: PH.p1.href },
      { slot: "web-p2", cat: "Técnica", titulo: "Sentadilla: los tres errores que más corrijo", bajada: "Rodillas, cadera y mirada. Cómo detectarlos vos mismo grabándote con el celular.", meta: "6 min · 05/08/2026", src: PH.p2.src, credit: PH.p2.credit, creditHref: PH.p2.href },
      { slot: "web-p3", cat: "Running", titulo: "Tu primer 10K en 12 semanas", bajada: "El plan completo, con los días de descanso que casi nadie respeta.", meta: "8 min · 28/07/2026", src: PH.p3.src, credit: PH.p3.credit, creditHref: PH.p3.href },
    ],

    chipsServicio: SERVICIOS.filter((x) => x.id !== "online").map((x) => ({
      label: x.nombre, ...sel(st.servicio === x.id), onClick: () => set({ servicio: x.id, hora: null }),
    })),
    dias: dias.map((d) => ({
      dow: d.dow, num: d.num, ...sel(st.dia === d.i),
      dot: d.libre ? (st.dia === d.i ? AC : "rgba(145,132,217,.5)") : "transparent",
      onClick: () => set({ dia: d.i, hora: null }),
    })),
    horarios: HORAS.map((h) => {
      const on = st.hora === h.hora;
      const base = h.lleno ? { bg: "transparent", bd: "rgba(233,233,237,.07)", fg: "rgba(233,233,237,.3)" } : sel(on);
      return { hora: h.hora, cupos: h.cupos, ...base, cursor: h.lleno ? "not-allowed" : "pointer", onClick: h.lleno ? undefined : () => set({ hora: h.hora }) };
    }),
    recurrente: st.recurrente, toggleRecurrente: () => set((p) => ({ recurrente: !p.recurrente })),
    resumenItems: [
      { k: "Clase", v: s.nombre }, { k: "Día", v: diaSel.dow + " " + diaSel.num + " de agosto" },
      { k: "Horario", v: st.hora || "Elegí un horario" }, { k: "Lugar", v: "Gorriti 4200, Palermo" },
      { k: "Repetir semanal", v: st.recurrente ? "Sí, 4 semanas" : "No" },
    ],
    resumenPrecio: st.creditos > 0 ? "1 crédito" : money(s.precio),
    creditos: st.creditos, creditosPct: (st.creditos / 8) * 100 + "%",
    irCheckout: () => { if (!st.hora) { showToast("Elegí un horario disponible"); return; } set({ packSel: null }); go("checkout"); },

    metodos: [
      { id: "bono", label: "Crédito del bono", sub: st.creditos + " clases disponibles", icon: "ph-ticket" },
      { id: "tarjeta", label: "Tarjeta de crédito", sub: "Visa •••• 3704 · hasta 6 cuotas", icon: "ph-credit-card" },
      { id: "mp", label: "Mercado Pago", sub: "Dinero en cuenta o transferencia", icon: "ph-wallet" },
      { id: "efectivo", label: "Efectivo en el estudio", sub: "Reservás ahora y pagás al llegar", icon: "ph-money" },
    ].filter((m) => !(m.id === "bono" && packSel)).map((m) => {
      const on = st.metodo === m.id;
      return {
        ...m, bd: on ? AC : DIV, bg: on ? "rgba(145,132,217,.10)" : "transparent",
        dotBd: on ? AC : "rgba(233,233,237,.35)", dotBg: on ? AC : "transparent", dotIn: on ? "inset 0 0 0 3px #161826" : "none",
        onClick: () => set({ metodo: m.id as AppState["metodo"] }),
      };
    }),
    mostrarTarjeta: st.metodo === "tarjeta",
    cuotas: [1, 3, 6].map((c) => ({ label: c === 1 ? "1 pago" : c + " cuotas sin interés", ...sel(st.cuota === c), onClick: () => set({ cuota: c }) })),
    checkoutItems: packSel
      ? [{ k: "Producto", v: packSel.nombre }, { k: "Detalle", v: packSel.desc }, { k: "Vigencia", v: packSel.id === "mensual" ? "Renovación mensual" : "90 días" }, { k: "Cuotas", v: st.metodo === "tarjeta" ? (st.cuota === 1 ? "1 pago" : st.cuota + " cuotas") : "—" }]
      : [{ k: "Clase", v: s.nombre }, { k: "Día y hora", v: diaSel.dow + " " + diaSel.num + "/08 · " + (st.hora || "—") }, { k: "Lugar", v: "Gorriti 4200, Palermo" }, { k: "Repetir semanal", v: st.recurrente ? "Sí, 4 semanas" : "No" }],
    totalFmt: !packSel && st.metodo === "bono" ? "1 crédito" : money(total),
    ctaPago: packSel ? "Pagar " + money(packSel.precio) : st.metodo === "bono" ? "Confirmar con 1 crédito" : "Pagar " + money(s.precio),
    pagar: () => {
      set((p) => ({ creditos: packSel ? (packSel.id === "bono8" ? 8 : packSel.id === "bono4" ? p.creditos + 4 : p.creditos) : p.metodo === "bono" ? Math.max(0, p.creditos - 1) : p.creditos }));
      go("confirm");
    },
    confirmItems: packSel
      ? [{ k: "Compra", v: packSel.nombre }, { k: "Total", v: money(packSel.precio) }, { k: "Comprobante", v: "Enviado a camila.f@gmail.com" }, { k: "Disponible", v: "Ya podés reservar" }]
      : [{ k: "Clase", v: s.nombre }, { k: "Cuándo", v: diaSel.dow + " " + diaSel.num + "/08 · " + (st.hora || "19:00") }, { k: "Lugar", v: "Gorriti 4200, Palermo" }, { k: "Pagado con", v: st.metodo === "bono" ? "1 crédito del bono" : money(s.precio) }],

    cuentaTabs: [
      { id: "reservas", label: "Mis reservas", icon: "ph-calendar-check" },
      { id: "rutina", label: "Mi rutina", icon: "ph-barbell" },
      { id: "paquetes", label: "Paquetes y pagos", icon: "ph-ticket" },
      { id: "notis", label: "Notificaciones", icon: "ph-bell" },
      { id: "datos", label: "Mis datos", icon: "ph-user" },
    ].map((t) => {
      const on = st.cuentaTab === t.id;
      return { label: t.label, icon: t.icon, bg: on ? "rgba(145,132,217,.14)" : "transparent", fg: on ? "#d2cefd" : "rgba(233,233,237,.75)", onClick: goTab(t.id as AppState["cuentaTab"]) };
    }),
    reservas: [
      { dow: "MAR", num: "18", clase: "Funcional / HIIT", hora: "19:00 – 19:50", lugar: "Estudio Palermo", estado: "Confirmada", tagClass: "tag-accent", accionesShow: "flex", op: 1 },
      { dow: "JUE", num: "20", clase: "Outdoor / Running", hora: "07:00 – 08:00", lugar: "Bosques de Palermo", estado: "Confirmada", tagClass: "tag-accent", accionesShow: "flex", op: 1 },
      { dow: "SÁB", num: "22", clase: "Personalizado 1 a 1", hora: "10:00 – 11:00", lugar: "Estudio Palermo", estado: "Lista de espera", tagClass: "tag-outline", accionesShow: "flex", op: 1 },
    ].map((r) => ({ ...r, onCancel: () => showToast("Reserva cancelada · crédito devuelto a tu bono"), onMove: () => go("reservar") })),
    historial: [
      { fecha: "14/08/2026", clase: "Musculación", estado: "Asististe", pago: "1 crédito" },
      { fecha: "12/08/2026", clase: "Funcional / HIIT", estado: "Asististe", pago: "1 crédito" },
      { fecha: "10/08/2026", clase: "Outdoor / Running", estado: "Cancelada a tiempo", pago: "Devuelto" },
      { fecha: "07/08/2026", clase: "Personalizado 1 a 1", estado: "Asististe", pago: money(22000) },
    ],
    pagos: [
      { fecha: "01/08/2026", concepto: "Bono 8 clases", medio: "Visa •••3704 · 3 cuotas", importe: money(80000) },
      { fecha: "07/07/2026", concepto: "Clase personalizada", medio: "Mercado Pago", importe: money(22000) },
      { fecha: "02/06/2026", concepto: "Bono 4 clases", medio: "Visa •••3704", importe: money(43000) },
    ],
    diasRutina: ["Día 1 · Fuerza", "Día 2 · Tren inferior", "Día 3 · Running", "Día 4 · HIIT"].map((l, i) => ({ label: l, ...sel(st.rutinaDia === i), onClick: () => set({ rutinaDia: i }) })),
    ejercicios,
    notis: [
      { icon: "ph-calendar-check", titulo: "Recordatorio: Funcional hoy 19:00", texto: "Llegá 10 minutos antes para la entrada en calor.", cuando: "Hace 20 min", bg: "rgba(145,132,217,.10)" },
      { icon: "ph-ticket", titulo: "Te quedan 6 clases del bono", texto: "Vence el 30/09. Renovalo antes con 10% de descuento.", cuando: "Ayer", bg: SUR },
      { icon: "ph-barbell", titulo: "Beto actualizó tu rutina", texto: "Bloque 2: subimos la carga en sentadilla y sumamos movilidad de cadera.", cuando: "Hace 2 días", bg: SUR },
      { icon: "ph-receipt", titulo: "Pago acreditado", texto: "Bono 8 clases · " + money(80000) + " · Visa •••3704", cuando: "Hace 5 días", bg: SUR },
    ],

    coachKpis: [
      { k: "Ingresos del mes", v: money(1840000), d: "+18% vs julio" },
      { k: "Clases esta semana", v: "23", d: "86% de ocupación" },
      { k: "Clientes activos", v: "61", d: "+4 nuevos" },
      { k: "Bonos por vencer", v: "7", d: "Conviene avisar" },
    ],
    agenda: [
      { hora: "07:00", clase: "Outdoor / Running", gente: "6 de 8 anotados", estado: "Cerrada", tagClass: "tag-neutral", marca: "#595d6c" },
      { hora: "09:00", clase: "Personalizado · Martín D.", gente: "Bloque 3, semana 2", estado: "En curso", tagClass: "tag-accent", marca: AC },
      { hora: "12:00", clase: "Evaluación inicial · Lucía G.", gente: "Primera vez", estado: "Nueva", tagClass: "tag-outline", marca: AC },
      { hora: "18:00", clase: "Musculación", gente: "5 de 8 anotados", estado: "Cupo libre", tagClass: "tag-outline", marca: AC },
      { hora: "19:00", clase: "Funcional / HIIT", gente: "8 de 8 · 2 en lista de espera", estado: "Completa", tagClass: "tag-accent", marca: AC },
    ],
    barras: [
      { dia: "Lun", pct: "86%", h: "86%", color: AC }, { dia: "Mar", pct: "92%", h: "92%", color: AC },
      { dia: "Mié", pct: "74%", h: "74%", color: "#5d5294" }, { dia: "Jue", pct: "88%", h: "88%", color: AC },
      { dia: "Vie", pct: "65%", h: "65%", color: "#5d5294" }, { dia: "Sáb", pct: "48%", h: "48%", color: "#423a6a" },
    ],
    clientes: [
      { ini: "CF", nombre: "Camila Ferreyra", motivo: "Bono vence en 6 días", cta: "Avisar" },
      { ini: "MD", nombre: "Martín Duarte", motivo: "Rutina sin actualizar hace 5 semanas", cta: "Asignar" },
      { ini: "SL", nombre: "Sofía Lema", motivo: "Faltó a las últimas 2 clases", cta: "Escribir" },
      { ini: "LG", nombre: "Lucía Giménez", motivo: "Evaluación inicial sin plan cargado", cta: "Cargar" },
    ],
    pagosCoach: [
      { cliente: "Camila F.", concepto: "Bono 8 clases", importe: money(80000) },
      { cliente: "Nicolás P.", concepto: "Mensualidad", importe: money(150000) },
      { cliente: "Julieta R.", concepto: "Bono 4 clases", importe: money(43000) },
      { cliente: "Martín D.", concepto: "Personalizada suelta", importe: money(22000) },
    ],

    toast: st.toast || "", toastShow: st.toast ? "block" : "none",
    loading: status === "loading",
    auth: auth,
    sessionStatus: status,
  };

  return vals;
}

export type BetoVals = ReturnType<typeof useBetoApp>;