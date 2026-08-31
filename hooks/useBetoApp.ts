"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
import { AC, ACD, DIV, DOW, SUR, money } from "@/lib/data";
import type { AppState, Screen } from "@/lib/types";

const initialState: AppState = {
  screen: "landing", cuentaTab: "reservas", prev: [],
  servicio: "funcional", dia: 2, hora: null, recurrente: false,
  metodo: "tarjeta", cuota: 1, packSel: null, claseSeleccionadaId: null,
  toast: null,

  fichaId: null,
  programaIdActivo: null,
  semanaSel: 1,
  editorOpen: false,
  editorDiaId: null,
  editorBloqueId: null,
  diaClienteSel: 0,
  asignadosSel: {},
  temaPdfSel: "black",
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

interface ServicioVals {
  id: string;
  nombre: string;
  tag: string;
  descripcion: string;
  imagenUrl: string;
  duracionMin: number;
  precio: number;
  cupoMax: number;
  horarios: { id: string; diaSemana: number; horaInicio: string }[];
}
interface PlanVals {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  unidad: string;
  badge: string;
  feats: string[];
}
const SERVICIO_VACIO: ServicioVals = { id: "", nombre: "", tag: "", descripcion: "", imagenUrl: "", duracionMin: 0, precio: 0, cupoMax: 0, horarios: [] };

function svc(lista: ServicioVals[], id: string) {
  return lista.find((s) => s.id === id) || lista[0] || SERVICIO_VACIO;
}

const sel = (on: boolean) => ({
  bg: on ? "rgba(232,40,40,.16)" : "transparent",
  bd: on ? AC : DIV,
  fg: on ? "#FF7A7A" : "#F4F4F5",
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

interface ReservaApi {
  id: string;
  claseId: string;
  fecha: string;
  servicio: string;
  servicioSlug: string;
  duracionMin: number;
  estado: "CONFIRMADA" | "LISTA_ESPERA";
  esCancelable: boolean;
}

function formatearRangoHora(fechaISO: string, duracionMin: number): string {
  const inicio = new Date(fechaISO);
  const fin = new Date(inicio.getTime() + duracionMin * 60 * 1000);
  const hh = (d: Date) => d.toISOString().slice(11, 16);
  return `${hh(inicio)} – ${hh(fin)}`;
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
  const [reservasReales, setReservasReales] = useState<ReservaApi[]>([]);
  const [cargandoReservas, setCargandoReservas] = useState(false);
  const [pagosCoachReales, setPagosCoachReales] = useState<{ pagoId: string; cliente: string; concepto: string; medio: string; estado: string; montoPesos: number; pendienteEfectivo: boolean }[]>([]);
  const [serviciosApi, setServiciosApi] = useState<ServicioVals[]>([]);
  const [planesApi, setPlanesApi] = useState<PlanVals[]>([]);

  useEffect(() => {
    fetch("/api/servicios").then((r) => r.json()).then((d) => setServiciosApi(d.servicios ?? [])).catch(() => setServiciosApi([]));
    fetch("/api/planes").then((r) => r.json()).then((d) => setPlanesApi(d.planes ?? [])).catch(() => setPlanesApi([]));
  }, []);

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
  const esAdmin = auth === "ADMIN";

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

  const cargarPagosCoach = useCallback(() => {
    if (!esAdmin) {
      Promise.resolve().then(() => setPagosCoachReales([]));
      return Promise.resolve();
    }
    return fetch("/api/coach/pagos")
      .then((r) => r.json())
      .then((d) => setPagosCoachReales(d.pagos ?? []))
      .catch(() => setPagosCoachReales([]));
  }, [esAdmin]);

  useEffect(() => {
    void cargarPagosCoach();
  }, [esAdmin, cargarPagosCoach]);

  const cargarReservasReales = useCallback(() => {
    if (!esCliente) {
      Promise.resolve().then(() => setReservasReales([]));
      return Promise.resolve();
    }
    Promise.resolve().then(() => setCargandoReservas(true));
    return fetch("/api/reservas")
      .then((r) => r.json())
      .then((d) => setReservasReales(d.reservas ?? []))
      .catch(() => setReservasReales([]))
      .finally(() => setCargandoReservas(false));
  }, [esCliente]);

  useEffect(() => {
    void cargarReservasReales();
  }, [state.screen, esCliente, cargarReservasReales]);

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
  const s = svc(serviciosApi, st.servicio);
  const dias = diasData();
  const diaSel = dias[st.dia];
  const packSel = planesApi.find((p) => p.id === st.packSel) ?? null;
  const total = packSel ? packSel.precio : s.precio;

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

  const cancelarReserva = async (reservaId: string) => {
    const res = await fetch(`/api/reservas/${reservaId}/cancelar`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast("Reserva cancelada · podés reprogramar");
      void cargarReservasReales();
    } else {
      showToast(data.error ?? "No se pudo cancelar la reserva");
    }
  };

  const goCoach = () => {
    go(auth === "ADMIN" ? "coach" : "login");
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
    isServiciosAdmin: st.screen === "servicios-admin",
    esCliente, esAdmin,
    cuentaLabel: auth ? "Mi cuenta" : "Ingresar",
    logoutShow: auth ? "inline-flex" : "none",
    reservarClaseShow: esAdmin ? "none" : "inline-flex",
    logout,
    loginTitulo: "Entrá a tu cuenta",
    loginBajada: "Tus reservas, tu rutina, tu mensualidad y tus pagos en un solo lugar. Si ya compraste una clase, ya tenés cuenta.",
    loginBullets: [
      { icon: "ph-ticket", t: "Reservás y pagás tu clase o garantizás tu mensualidad" },
      { icon: "ph-barbell", t: "Ves la rutina que te asignó Beto" },
      { icon: "ph-receipt", t: "Historial de pagos y comprobantes" },
    ],
    loginError,
    errorShow: loginError ? "block" : "none",
    setLoginError,
    loginCta: "Ingresar",
    loginNota: "Si no tenés cuenta, podés crearla en 1 minuto.",
    entrar,
    tabReservas: st.screen === "cuenta" && st.cuentaTab === "reservas",
    tabRutina: st.screen === "cuenta" && st.cuentaTab === "rutina",
    tabPaquetes: st.screen === "cuenta" && st.cuentaTab === "paquetes",
    tabDatos: st.screen === "cuenta" && st.cuentaTab === "datos",
    tabNotis: st.screen === "cuenta" && st.cuentaTab === "notis",

    back,
    goLanding: () => go("landing"), goReservar: () => go(auth ? "reservar" : "login"),
    goCuenta: () => go(auth ? "cuenta" : "login"),
    goCoach,
    goClientes, goFicha, goBuilder, goAsignar, goPdf,
    goServiciosAdmin: () => go("servicios-admin"),
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
    ].map((n) => ({ ...n, fg: "rgba(244,244,245,.75)" })),

    heroStats: [{ v: "340+", k: "Personas entrenadas" }, { v: "12", k: "Años de experiencia" }, { v: "4,9", k: "Puntaje promedio" }],
    bandas: [
      { icon: "ph-calendar-check", t: "Reservás online", d: "Elegís día y horario, con cupos en tiempo real." },
      { icon: "ph-credit-card", t: "Pagás en la web", d: "Tarjeta, Mercado Pago o efectivo en persona." },
      { icon: "ph-ticket", t: "Mensualidad o clase suelta", d: "Comprás el plan que mejor acompañe tu rutina." },
      { icon: "ph-users-three", t: "Grupos de hasta 8", d: "Corrección técnica personalizada en cada clase." },
    ],
    servicios: serviciosApi.map((x) => ({
      id: x.id, nombre: x.nombre, tag: x.tag, desc: x.descripcion, foto: x.nombre,
      dur: x.duracionMin === 0 ? "A tu ritmo" : `${x.duracionMin} min`,
      cupo: x.horarios.length > 0 ? `${x.horarios.length} horario${x.horarios.length === 1 ? "" : "s"} por semana` : "Sin horarios cargados",
      precioFmt: x.precio === 0 ? "Sin cargo" : money(x.precio),
      src: x.imagenUrl, credit: "", creditHref: "",
      onClick: () => { set({ servicio: x.id === "evaluacion" ? "personal" : x.id }); go(auth ? "reservar" : "login"); },
    })),
    pasos: [
      { n: "01", t: "Elegí la clase", d: "Personalizada, grupal, outdoor u online." },
      { n: "02", t: "Reservá el turno", d: "Día y horario con cupo confirmado al instante." },
      { n: "03", t: "Pagá como quieras", d: "Tarjeta, Mercado Pago o efectivo en el estudio." },
      { n: "04", t: "Entrená y seguí tu plan", d: "Tu rutina y tu progreso quedan en tu cuenta." },
    ],
    packs: planesApi.map((p) => ({
      id: p.id, nombre: p.nombre, desc: p.descripcion, unit: p.unidad, badge: p.badge,
      precioFmt: money(p.precio), feats: p.feats.map((f) => ({ t: f })), badgeShow: p.badge ? "inline-flex" : "none",
      cta: p.id === "suelta" ? "Reservar" : "Suscribirme",
      bd: p.id === "mensual" ? AC : DIV, bg: p.id === "mensual" ? "linear-gradient(150deg," + ACD + "," + SUR + ")" : "transparent",
      onClick: () => { set({ packSel: p.id, metodo: "tarjeta" }); go(p.id === "suelta" ? "reservar" : "checkout"); },
    })),
    coachStats: [{ v: "12", k: "Años entrenando" }, { v: "340+", k: "Alumnos" }, { v: "4,9", k: "Reseñas" }],
    certs: ["Prof. ED Fisica", "Preparador Fisico", "Entrenador Funcional", "RCP y primeros auxilios", "Running coach", "Trial coach"].map((t) => ({ t })),
    testimonios: [
      { slot: "web-t1", estrellas: "★★★★★", texto: "«En cuatro meses volví a correr sin dolor de rodilla. Beto te corrige todo, no te deja pasar una repetición mal hecha.»", autor: "Julieta R. · Outdoor, 8 meses" },
      { slot: "web-t2", estrellas: "★★★★★", texto: "«Arranqué sin haber pisado un gimnasio nunca. Nadie te mira raro y el plan se ajusta a lo que podés hacer hoy.»", autor: "Martín D. · Personalizado, 1 año" },
      { slot: "web-t3", estrellas: "★★★★★", texto: "«Bajé 11 kg en un año, pero lo mejor es que ahora entreno porque quiero, no porque me obligo.»", autor: "Nicolás P. · Musculación, 14 meses" },
    ],
    chipsServicio: serviciosApi.filter((x) => x.id !== "online").map((x) => ({
      label: x.nombre, ...sel(st.servicio === x.id), onClick: () => set({ servicio: x.id, hora: null }),
    })),
    dias: dias.map((d) => ({
      dow: d.dow, num: d.num, ...sel(st.dia === d.i),
      dot: d.libre ? (st.dia === d.i ? AC : "rgba(232,40,40,.5)") : "transparent",
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
        const base = c.lleno ? { bg: "transparent", bd: "rgba(244,244,245,.07)", fg: "rgba(244,244,245,.3)" } : sel(on);
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
      const servicioSeleccionado = serviciosApi.find((x) => x.id === st.servicio);
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
        ...m, bd: on ? AC : DIV, bg: on ? "rgba(232,40,40,.10)" : "transparent",
        dotBd: on ? AC : "rgba(244,244,245,.35)", dotBg: on ? AC : "transparent", dotIn: on ? "inset 0 0 0 3px #000" : "none",
        onClick: () => set({ metodo: m.id as AppState["metodo"] }),
      };
    }),
    mostrarTarjeta: st.metodo === "tarjeta",
    cuotas: [1, 3, 6].map((c) => ({ label: c === 1 ? "1 pago" : c + " cuotas sin interés", ...sel(st.cuota === c), onClick: () => set({ cuota: c }) })),
    checkoutItems: packSel
      ? [{ k: "Producto", v: packSel.nombre }, { k: "Detalle", v: packSel.descripcion }, { k: "Vigencia", v: packSel.id === "mensual" ? "Renovación mensual" : "90 días" }, { k: "Cuotas", v: st.metodo === "tarjeta" ? (st.cuota === 1 ? "1 pago" : st.cuota + " cuotas") : "—" }]
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
        void cargarPagosCoach();
      } else {
        showToast("No se pudo marcar el pago");
      }
    },
    confirmItems: packSel
      ? [{ k: "Compra", v: packSel.nombre }, { k: "Total", v: money(packSel.precio) }, { k: "Comprobante", v: `Enviado a ${session?.user?.email ?? "tu email"}` }, { k: "Disponible", v: "Ya podés reservar" }]
      : [{ k: "Clase", v: s.nombre }, { k: "Cuándo", v: diaSel.dow + " " + diaSel.num + "/08 · " + (st.hora || "19:00") }, { k: "Lugar", v: "Gorriti 4200, Palermo" }, { k: "Pagado con", v: money(s.precio) }],

    cuentaTabs: [
      { id: "reservas", label: "Mis reservas", icon: "ph-calendar-check" },
      { id: "rutina", label: "Mi rutina", icon: "ph-barbell" },
      { id: "paquetes", label: "Paquetes y pagos", icon: "ph-ticket" },
      { id: "notis", label: "Notificaciones", icon: "ph-bell" },
      { id: "datos", label: "Mis datos", icon: "ph-user" },
    ].map((t) => {
      const on = st.cuentaTab === t.id;
      return { label: t.label, icon: t.icon, bg: on ? "rgba(232,40,40,.14)" : "transparent", fg: on ? "#FF7A7A" : "rgba(244,244,245,.75)", onClick: goTab(t.id as AppState["cuentaTab"]) };
    }),
    reservas: reservasReales.map((r) => {
      const fecha = new Date(r.fecha);
      const num = String(fecha.getDate());
      const estadoTexto = r.estado === "CONFIRMADA" ? "Confirmada" : "Lista de espera";
      return {
        key: r.id,
        dow: DOW[fecha.getDay()],
        num,
        clase: r.servicio,
        hora: formatearRangoHora(r.fecha, r.duracionMin),
        lugar: "Estudio Palermo",
        estado: estadoTexto,
        tagClass: r.estado === "CONFIRMADA" ? "tag-accent" : "tag-outline",
        accionesShow: r.esCancelable ? "flex" : "none",
        op: r.estado === "CONFIRMADA" ? 1 : 0.8,
        onCancel: () => cancelarReserva(r.id),
        onMove: () => go("reservar"),
      };
    }),
    cargandoReservas,
    cancelarReserva,
    pagosCoach: pagosCoachReales.map((p) => ({
      pagoId: p.pagoId,
      cliente: p.cliente,
      concepto: p.concepto,
      importe: money(p.montoPesos),
      pendienteEfectivo: p.pendienteEfectivo,
      medio: p.medio,
      estado: p.estado,
    })),

    toast: st.toast || "", toastShow: st.toast ? "block" : "none",
    loading: status === "loading",
    auth: auth,
    sessionStatus: status,
  };

  return vals;
}

export type BetoVals = ReturnType<typeof useBetoApp>;