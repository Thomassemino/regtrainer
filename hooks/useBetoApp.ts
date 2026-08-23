"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
import { AC, ACD, DIV, DOW, PACKS, PH, SERVICIOS, SUR, money } from "@/lib/data";
import type { AppState, Screen } from "@/lib/types";

const initialState: AppState = {
  screen: "landing", cuentaTab: "reservas", prev: [],
  servicio: "funcional", dia: 2, hora: null, recurrente: false,
  metodo: "tarjeta", cuota: 1, packSel: null, claseSeleccionadaId: null,
  toast: null,
  loginRolUI: "cliente",

  fichaId: null,
  programaIdActivo: null,
  semanaSel: 1,
  editorOpen: false,
  editorDiaId: null,
  editorBloqueId: null,
  diaClienteSel: 0,
  asignadosSel: {},
  temaPdfSel: "clean",
};

function diasData() {
  // El calendario del frontend parte de la fecha actual (no de una fecha mock fija):
  // las Clase reales se generan desde "hoy" hacia adelante (spec §9), así que el
  // día por defecto debe tener instancias reales para que los horarios se muestren.
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, i) => {
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

interface ClaseApi {
  id: string;
  servicioId: string;
  servicioSlug: string;
  fecha: string;
  cupoMax: number;
  cuposOcupados: number;
  cuposDisponibles: number;
  lleno: boolean;
}

export function useBetoApp() {
  const { data: session, status } = useSession();
  const params = useSearchParams();
  const [state, setState] = useState<AppState>(() => ({ ...initialState, screen: "landing" }));
  const [loginError, setLoginError] = useState("");
  const prevAuth = useRef<string | null>(null);
  const transitionNavigated = useRef(false);
  const [clasesDisponibles, setClasesDisponibles] = useState<ClaseApi[]>([]);
  const [cargandoClases, setCargandoClases] = useState(false);
  const [suscripcionActiva, setSuscripcionActiva] = useState(false);

  useEffect(() => {
    if (state.screen !== "reservar") return;
    const servicioSlug = state.servicio;
    Promise.resolve().then(() => setCargandoClases(true));
    fetch(`/api/clases?slug=${encodeURIComponent(servicioSlug)}`)
      .then((r) => r.json())
      .then((data) => setClasesDisponibles(data.clases ?? []))
      .finally(() => setCargandoClases(false));
  }, [state.screen, state.servicio]);

  useEffect(() => {
    if (status === "authenticated" && !session?.user) {
      void nextAuthSignOut({ redirect: false });
    }
  }, [status, session]);

  const auth = session?.user?.role ?? null;
  const esCliente = auth === "CLIENTE";

  useEffect(() => {
    if (!esCliente) {
      Promise.resolve().then(() => setSuscripcionActiva(false));
      return;
    }
    fetch("/api/cuenta/mensualidad")
      .then((r) => (r.ok ? r.json() : { activa: false }))
      .then((data) => setSuscripcionActiva(!!data.activa))
      .catch(() => setSuscripcionActiva(false));
  }, [esCliente]);

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
  }, [set]);

  useEffect(() => {
    if (!state.toast) return;
    const id = setTimeout(() => set({ toast: null }), 2400);
    return () => clearTimeout(id);
  }, [state.toast, set]);

  useEffect(() => {
    const wasNull = prevAuth.current === null && auth !== null;
    if (wasNull) {
      const admin = auth === "ADMIN";
      go(admin ? "coach" : "cuenta");
      showToast(admin ? "Bienvenido, Beto" : "Hola de nuevo");
      transitionNavigated.current = true;
    }
    prevAuth.current = auth;
  }, [auth, go, showToast]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (transitionNavigated.current) return;
    if (params.get("screen") !== "coach" || session.user.role !== "ADMIN") return;
    if (state.screen !== "landing") return;
    const id = setTimeout(() => {
      setState((s) => (s.screen === "landing" ? { ...s, screen: "coach" } : s));
    }, 0);
    return () => clearTimeout(id);
  }, [status, session, params, state.screen, setState]);

  const st = state;
  const s = svc(st.servicio);
  const dias = diasData();
  const diaSel = dias[st.dia];
  const packSel = PACKS.find((p) => p.id === st.packSel) ?? null;
  const total = packSel ? packSel.precio : s.precio;

  const esAdmin = auth === "ADMIN";

  const goTab = (t: AppState["cuentaTab"]) => () => set({ cuentaTab: t, screen: "cuenta" });

  const entrar = async (email: string, password: string) => {
    const result = await nextAuthSignIn("credentials", { email, password, redirect: false });
    if (!result || result.error) {
      setLoginError("Email o contraseña incorrectos");
      return;
    }
    const res = await fetch("/api/auth/session");
    const sess = await res.json();
    const role = sess?.user?.role as "CLIENTE" | "ADMIN" | null | undefined;
    go(role === "ADMIN" ? "coach" : "cuenta");
    showToast(role === "ADMIN" ? "Bienvenido, Beto" : "Hola de nuevo");
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

  const goClientes = () => go("clientes");
  const goFicha = (clienteId: string) => { set({ fichaId: clienteId }); go("ficha"); };
  const goBuilder = (programaId: string) => { set({ programaIdActivo: programaId, semanaSel: 1 }); go("builder"); };
  const goAsignar = () => go("asignar");
  const goPdf = () => go("pdf");

  const abrirEditor = (diaId: string, bloqueId: string | null) =>
    set({ editorOpen: true, editorDiaId: diaId, editorBloqueId: bloqueId });
  const cerrarEditor = () =>
    set({ editorOpen: false, editorDiaId: null, editorBloqueId: null });

  const toggleAsignado = (clienteId: string) =>
    set((p) => ({ asignadosSel: { ...p.asignadosSel, [clienteId]: !p.asignadosSel[clienteId] } }));

  const setSemanaSel = (semana: number) => set({ semanaSel: semana });
  const setDiaClienteSel = (dia: number) => set({ diaClienteSel: dia });
  const setTemaPdfSel = (tema: AppState["temaPdfSel"]) => set({ temaPdfSel: tema });

  const vals = {
    isLanding: st.screen === "landing", isReservar: st.screen === "reservar", isCheckout: st.screen === "checkout",
    isConfirm: st.screen === "confirm", isCuenta: st.screen === "cuenta", isCoach: st.screen === "coach",
    isLogin: st.screen === "login",
    isClientes: st.screen === "clientes",
    isFicha: st.screen === "ficha",
    isBuilder: st.screen === "builder",
    isAsignar: st.screen === "asignar",
    isPdf: st.screen === "pdf",
    esCliente, esAdmin,
    cuentaLabel: auth ? "Mi cuenta" : "Ingresar",
    logoutShow: auth ? "inline-flex" : "none",
    logout,
    loginTitulo: st.loginRolUI === "admin" ? "Panel del entrenador" : "Entrá a tu cuenta",
    loginBajada: st.loginRolUI === "admin"
      ? "Acceso exclusivo de Beto: agenda del día, clientes, cobros y asignación de rutinas."
      : "Tus reservas, tu rutina, tu mensualidad y tus pagos en un solo lugar. Si ya compraste una clase, ya tenés cuenta.",
    loginBullets: (st.loginRolUI === "admin"
      ? [{ icon: "ph-calendar-check", t: "Agenda del día con cupos y lista de espera" }, { icon: "ph-users-three", t: "Ficha de cada cliente, rutinas y asistencias" }, { icon: "ph-chart-line-up", t: "Ingresos y ocupación" }]
      : [{ icon: "ph-ticket", t: "Reservás y pagás tu clase o garantizás tu mensualidad" }, { icon: "ph-barbell", t: "Ves la rutina que te asignó Beto" }, { icon: "ph-receipt", t: "Historial de pagos y comprobantes" }]),
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
    loginError,
    errorShow: loginError ? "block" : "none",
    setLoginError,
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
    goClientes, goFicha, goBuilder, goAsignar, goPdf,
    abrirEditor, cerrarEditor, toggleAsignado,
    setSemanaSel, setDiaClienteSel, setTemaPdfSel,
    fichaId: st.fichaId,
    programaIdActivo: st.programaIdActivo,
    semanaSel: st.semanaSel,
    editorOpen: st.editorOpen,
    editorDiaId: st.editorDiaId,
    editorBloqueId: st.editorBloqueId,
    diaClienteSel: st.diaClienteSel,
    asignadosSel: st.asignadosSel,
    temaPdfSel: st.temaPdfSel,
    setProgramaIdActivo: (id: string | null) => set({ programaIdActivo: id }),
    set,
    showToast,
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
      { icon: "ph-ticket", t: "Mensualidad o clase suelta", d: "Comprás el plan que mejor acompañe tu rutina." },
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
      { n: "03", t: "Pagá como quieras", d: "Tarjeta, Mercado Pago o efectivo en el estudio." },
      { n: "04", t: "Entrená y seguí tu plan", d: "Tu rutina y tu progreso quedan en tu cuenta." },
    ],
    packs: PACKS.map((p) => ({
      ...p, precioFmt: money(p.precio), feats: p.feats.map((f) => ({ t: f })), badgeShow: p.badge ? "inline-flex" : "none",
      bd: p.id === "mensual" ? AC : DIV, bg: p.id === "mensual" ? "linear-gradient(150deg," + ACD + "," + SUR + ")" : "transparent",
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
    horarios: clasesDisponibles
      .filter((c) => {
        const fecha = new Date(c.fecha);
        return fecha.getDate() === diaSel.num;
      })
      .map((c) => {
        const horaStr = new Date(c.fecha).toISOString().slice(11, 16);
        const on = st.claseSeleccionadaId === c.id;
        const base = c.lleno ? { bg: "transparent", bd: "rgba(233,233,237,.07)", fg: "rgba(233,233,237,.3)" } : sel(on);
        return {
          hora: horaStr,
          cupos: c.lleno ? "Completo" : `${c.cuposDisponibles} lugares`,
          ...base,
          cursor: c.lleno ? "not-allowed" : "pointer",
          onClick: c.lleno ? undefined : () => set({ hora: horaStr, claseSeleccionadaId: c.id }),
        };
      }),
    cargandoHorarios: cargandoClases,
    recurrente: st.recurrente, toggleRecurrente: () => set((p) => ({ recurrente: !p.recurrente })),
    resumenItems: [
      { k: "Clase", v: s.nombre }, { k: "Día", v: diaSel.dow + " " + diaSel.num + " de agosto" },
      { k: "Horario", v: st.hora || "Elegí un horario" }, { k: "Lugar", v: "Gorriti 4200, Palermo" },
      { k: "Repetir semanal", v: st.recurrente ? "Sí, 4 semanas" : "No" },
    ],
    resumenPrecio: (() => {
      const clase = clasesDisponibles.find((c) => c.id === st.claseSeleccionadaId);
      if (!clase) return "—";
      const servicioSeleccionado = SERVICIOS.find((x) => x.id === st.servicio);
      if (!servicioSeleccionado || servicioSeleccionado.precio === 0) return "Sin cargo";
      if (suscripcionActiva && servicioSeleccionado.id !== "personal") return "Cubierto por tu mensualidad";
      return money(servicioSeleccionado.precio);
    })(),
    irCheckout: () => {
      if (!st.claseSeleccionadaId) {
        showToast("Elegí un horario disponible");
        return;
      }
      set({ packSel: null });
      go("checkout");
    },

    metodos: [
      { id: "tarjeta", label: "Tarjeta de crédito o débito", sub: "Vía Mercado Pago, hasta 6 cuotas", icon: "ph-credit-card" },
      { id: "mp", label: "Mercado Pago", sub: "Dinero en cuenta o transferencia", icon: "ph-wallet" },
      { id: "efectivo", label: "Efectivo en el estudio", sub: "Reservás ahora y pagás al llegar", icon: "ph-money" },
    ].map((m) => {
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
    totalFmt: money(total),
    ctaPago: packSel ? "Pagar " + money(packSel.precio) : "Pagar " + money(s.precio),
    pagar: async () => {
      if (packSel?.id === "mensual") {
        const res = await fetch("/api/pagos/mensualidad", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? "No pudimos iniciar el pago");
          return;
        }
        window.location.href = data.initPoint;
        return;
      }

      if (!st.claseSeleccionadaId) {
        showToast("Elegí una clase para reservar");
        return;
      }

      if (st.metodo === "efectivo") {
        const res = await fetch("/api/reservas", {
          method: "POST",
          body: JSON.stringify({ claseId: st.claseSeleccionadaId, medio: "EFECTIVO" }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? "No pudimos reservar la clase");
          return;
        }
        go("confirm");
        return;
      }

      const intento = await fetch("/api/reservas", {
        method: "POST",
        body: JSON.stringify({ claseId: st.claseSeleccionadaId }),
      });
      if (intento.status === 409) {
        const pagoRes = await fetch("/api/pagos/clase", {
          method: "POST",
          body: JSON.stringify({ claseId: st.claseSeleccionadaId }),
        });
        const pagoData = await pagoRes.json();
        if (!pagoRes.ok) {
          showToast(pagoData.error ?? "No pudimos iniciar el pago");
          return;
        }
        window.location.href = pagoData.initPoint;
        return;
      }
      const data = await intento.json();
      if (!intento.ok) {
        showToast(data.error ?? "No pudimos reservar la clase");
        return;
      }
      go("confirm");
    },
    marcarPagoRecibido: async (pagoId: string) => {
      const res = await fetch(`/api/coach/pagos/${pagoId}`, { method: "PATCH" });
      if (res.ok) {
        showToast("Pago marcado como recibido");
      } else {
        showToast("No se pudo marcar el pago");
      }
    },
    confirmItems: packSel
      ? [{ k: "Compra", v: packSel.nombre }, { k: "Total", v: money(packSel.precio) }, { k: "Comprobante", v: "Enviado a camila.f@gmail.com" }, { k: "Disponible", v: "Ya podés reservar" }]
      : [{ k: "Clase", v: s.nombre }, { k: "Cuándo", v: diaSel.dow + " " + diaSel.num + "/08 · " + (st.hora || "19:00") }, { k: "Lugar", v: "Gorriti 4200, Palermo" }, { k: "Pagado con", v: money(s.precio) }],

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
    ].map((r) => ({ ...r, onCancel: () => showToast("Reserva cancelada · podés reprogramar"), onMove: () => go("reservar") })),
    historial: [
      { fecha: "14/08/2026", clase: "Musculación", estado: "Asististe", pago: money(15000) },
      { fecha: "12/08/2026", clase: "Funcional / HIIT", estado: "Asististe", pago: money(12000) },
      { fecha: "10/08/2026", clase: "Outdoor / Running", estado: "Cancelada a tiempo", pago: "Devuelto" },
      { fecha: "07/08/2026", clase: "Personalizado 1 a 1", estado: "Asististe", pago: money(22000) },
    ],
    pagos: [
      { fecha: "01/08/2026", concepto: "Mensualidad", medio: "Visa •••3704 · 3 cuotas", importe: money(150000) },
      { fecha: "07/07/2026", concepto: "Clase personalizada", medio: "Mercado Pago", importe: money(22000) },
      { fecha: "02/06/2026", concepto: "Bono 4 clases", medio: "Visa •••3704", importe: money(43000) },
    ],
    notis: [
      { icon: "ph-calendar-check", titulo: "Recordatorio: Funcional hoy 19:00", texto: "Llegá 10 minutos antes para la entrada en calor.", cuando: "Hace 20 min", bg: "rgba(145,132,217,.10)" },
      { icon: "ph-ticket", titulo: "Tu mensualidad está al día", texto: "Clases grupales garantizadas + 1 personalizada por semana.", cuando: "Hoy", bg: SUR },
      { icon: "ph-barbell", titulo: "Beto actualizó tu rutina", texto: "Bloque 2: subimos la carga en sentadilla y sumamos movilidad de cadera.", cuando: "Hace 2 días", bg: SUR },
      { icon: "ph-receipt", titulo: "Pago acreditado", texto: "Mensualidad · " + money(150000) + " · Visa •••3704", cuando: "Hace 5 días", bg: SUR },
    ],

    coachKpis: [
      { k: "Ingresos del mes", v: money(1840000), d: "+18% vs julio" },
      { k: "Clases esta semana", v: "23", d: "86% de ocupación" },
      { k: "Clientes activos", v: "61", d: "+4 nuevos" },
      { k: "Rutinas sin actualizar", v: "7", d: "Conviene revisarlas" },
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
      { ini: "CF", nombre: "Camila Ferreyra", motivo: "Mensualidad vence en 6 días", cta: "Avisar" },
      { ini: "MD", nombre: "Martín Duarte", motivo: "Rutina sin actualizar hace 5 semanas", cta: "Asignar" },
      { ini: "SL", nombre: "Sofía Lema", motivo: "Faltó a las últimas 2 clases", cta: "Escribir" },
      { ini: "LG", nombre: "Lucía Giménez", motivo: "Evaluación inicial sin plan cargado", cta: "Cargar" },
    ],
    pagosCoach: ([
      { cliente: "Camila F.", concepto: "Mensualidad", importe: money(150000) },
      { cliente: "Nicolás P.", concepto: "Mensualidad", importe: money(150000) },
      { cliente: "Julieta R.", concepto: "Clase suelta", importe: money(12000) },
      { cliente: "Martín D.", concepto: "Personalizada suelta", importe: money(22000) },
    ] as { cliente: string; concepto: string; importe: string; pagoId?: string; pendienteEfectivo?: boolean }[]),

    toast: st.toast || "", toastShow: st.toast ? "block" : "none",
    loading: status === "loading",
    auth: auth,
    sessionStatus: status,
  };

  return vals;
}

export type BetoVals = ReturnType<typeof useBetoApp>;