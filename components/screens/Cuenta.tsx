"use client";

import { useEffect, useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import ImageSlot from "@/components/ImageSlot";
import { calcularSemanaActual } from "@/lib/rutinas/semana-actual";

interface SesionRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expires: string;
}

interface FilaSobrecargaVista { semana: number; series: number; reps: number; pct: number; descanso: string; }
interface BloqueVista { id: string; tipo: string; foco: string; titulo: string; detalle: string; meta: string | null; sobrecarga: FilaSobrecargaVista[]; }
interface DiaVista { id: string; diaSemana: number; descanso: boolean; calentamiento: string | null; bloques: BloqueVista[]; }
interface AsignacionVista { id: string; asignadoEn: string; programa: { nombre: string; semanas: number; dias: DiaVista[] } }

const NOMBRES_DIA: Record<number, string> = { 0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" };
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

export default function Cuenta({ vals }: { vals: BetoVals }) {
  const [sesiones, setSesiones] = useState<SesionRow[]>([]);
  const [actualId, setActualId] = useState<string>("");
  const [cerrandoMsg, setCerrandoMsg] = useState("");
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [miRutina, setMiRutina] = useState<AsignacionVista | null>(null);
  const [completados, setCompletados] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/cuenta/sesiones")
      .then((r) => r.json())
      .then((data) => {
        setSesiones(data.sesiones ?? []);
        setActualId(data.actualId ?? "");
      })
      .catch(() => {});
  }, []);

  const cerrarTodas = async () => {
    setCerrandoMsg("");
    const res = await fetch("/api/cuenta/sesiones/cerrar-todas", { method: "POST" });
    if (res.ok) {
      setCerrandoMsg("Sesión cerrada en todos los dispositivos");
      await vals.logout();
    }
  };

  const cambiarClave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg("");
    const res = await fetch("/api/cuenta/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual, nueva }),
    });
    const data = await res.json();
    if (res.ok) {
      setPassMsg("Contraseña actualizada");
      setActual("");
      setNueva("");
    } else {
      setPassMsg(data.error ?? "No pudimos cambiar la contraseña");
    }
  };

  useEffect(() => {
    fetch("/api/cuenta/mi-rutina")
      .then((r) => r.json())
      .then((data) => setMiRutina(data.asignacion ?? null));
  }, []);

  const marcarHecho = async (bloqueId: string, semana: number) => {
    const clave = `${bloqueId}-${semana}`;
    setCompletados((c) => ({ ...c, [clave]: true }));
    await fetch("/api/cuenta/mi-rutina/completar", { method: "POST", body: JSON.stringify({ bloqueId, semana }) });
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 72px", display: "grid", gridTemplateColumns: "236px 1fr", gap: 28, alignItems: "start" }}>
      <div style={{ position: "sticky", top: 86, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <ImageSlot alt="Camila Ferreyra" shape="circle" style={{ width: 44, height: 44, flex: "none" }} initials="CF" />
          <div><div style={{ fontSize: 14.5, fontWeight: 500 }}>Camila Ferreyra</div><div style={{ fontSize: 11.5, opacity: .5 }}>Cuenta de cliente</div></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {vals.cuentaTabs.map((t) => (
            <button key={t.label} onClick={t.onClick} style={{ cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: 0, background: t.bg, color: t.fg, fontSize: 13.5 }}>
              <i className={`ph ${t.icon}`} style={{ fontSize: 17 }} />{t.label}
            </button>
          ))}
        </div>
        <button onClick={vals.goCoach} className="btn btn-secondary btn-block"><i className="ph ph-shield-check" /> Panel del entrenador</button>
      </div>

      <div>
        {vals.tabReservas && (
          <div>
            <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 18px" }}>Mis reservas</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {vals.reservas.map((r) => (
                <div key={r.key ?? r.dow + r.num} style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 18px", borderRadius: 14, background: "var(--color-surface)", opacity: r.op }}>
                  <div style={{ width: 54, textAlign: "center", flex: "none" }}>
                    <div style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", opacity: .5 }}>{r.dow}</div>
                    <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, lineHeight: 1.1 }}>{r.num}</div>
                  </div>
                  <div style={{ width: 1, alignSelf: "stretch", background: "var(--color-divider)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{r.clase}</div>
                    <div style={{ fontSize: 12.5, opacity: .55, marginTop: 2 }}>{r.hora} · {r.lugar}</div>
                  </div>
                  <span className={`tag ${r.tagClass}`}>{r.estado}</span>
                  <div style={{ display: r.accionesShow as "flex" | "none", gap: 8 }}>
                    <button onClick={r.onMove} className="btn btn-secondary">Reprogramar</button>
                    <button onClick={r.onCancel} className="btn btn-ghost">Cancelar</button>
                  </div>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "32px 0 12px" }}>Historial</h3>
            <table className="table">
              <thead><tr><th>Fecha</th><th>Clase</th><th>Estado</th><th style={{ textAlign: "right" }}>Pago</th></tr></thead>
              <tbody>
                {vals.historial.map((h) => (
                  <tr key={h.fecha}><td>{h.fecha}</td><td>{h.clase}</td><td>{h.estado}</td><td style={{ textAlign: "right" }}>{h.pago}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {vals.tabRutina && (
          <div>
            {!miRutina ? (
              <div>
                <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Mi rutina</h2>
                <p style={{ fontSize: 13.5, opacity: .6 }}>Todavía no tenés un programa asignado. Cuando Beto te asigne uno, vas a verlo acá.</p>
              </div>
            ) : (() => {
              const dias = ORDEN_SEMANA.map((ds) => miRutina.programa.dias.find((d) => d.diaSemana === ds)).filter((d): d is DiaVista => !!d && !d.descanso);
              const diaActivo = dias[vals.diaClienteSel] ?? dias[0];
              const semanaActual = calcularSemanaActual(miRutina.asignadoEn, miRutina.programa.semanas);
              return (
                <div>
                  <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Mi rutina</h2>
                  <p style={{ fontSize: 13.5, opacity: .6, margin: "0 0 18px" }}>
                    {miRutina.programa.nombre} · {miRutina.programa.semanas} semanas · asignada por Beto el {new Date(miRutina.asignadoEn).toLocaleDateString("es-AR")}
                  </p>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    {dias.map((d, i) => {
                      const on = vals.diaClienteSel === i;
                      return (
                        <button
                          key={d.id}
                          onClick={() => vals.setDiaClienteSel(i)}
                          style={{ cursor: "pointer", fontSize: 13, padding: "9px 15px", borderRadius: 99, border: `1px solid ${on ? "var(--color-accent)" : "var(--color-divider)"}`, background: on ? "rgba(145,132,217,.16)" : "transparent", color: on ? "var(--color-accent-300)" : "var(--color-text)" }}
                        >
                          {NOMBRES_DIA[d.diaSemana]}
                        </button>
                      );
                    })}
                  </div>

                  {diaActivo && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 760 }}>
                      {diaActivo.calentamiento && (
                        <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--color-surface)" }}>
                          <div style={{ fontSize: 11, textTransform: "uppercase", opacity: .45 }}>Calentamiento</div>
                          <div style={{ fontSize: 13.5, opacity: .8, marginTop: 4 }}>{diaActivo.calentamiento}</div>
                        </div>
                      )}
                      {diaActivo.bloques.map((b, i) => {
                        const fila = b.sobrecarga.find((f) => f.semana === semanaActual);
                        const hecho = !!completados[`${b.id}-${semanaActual}`];
                        return (
                          <div key={b.id} style={{ padding: "16px 18px", borderRadius: 12, background: "var(--color-surface)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                              <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--color-accent-800)", color: "var(--color-accent-100)", display: "grid", placeItems: "center", fontSize: 11.5 }}>{i + 1}</span>
                              <span className="tag tag-accent">{b.tipo}</span>
                              {b.meta && <span style={{ fontSize: 10.5, opacity: .4 }}>{b.meta}</span>}
                              <span style={{ marginLeft: "auto", fontSize: 9.5, textTransform: "uppercase", opacity: .5 }}>{b.foco}</span>
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>{b.titulo}</div>
                            <div style={{ fontSize: 13, opacity: .6, marginBottom: 10 }}>{b.detalle}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                              {[
                                { label: "Series", valor: b.tipo === "TRADICIONAL" ? String(fila?.series ?? "—") : "—" },
                                { label: "Rep", valor: b.tipo === "TRADICIONAL" ? String(fila?.reps ?? "—") : "—" },
                                { label: "Carga", valor: b.tipo === "TRADICIONAL" ? `${fila?.pct ?? "—"}%` : "RPE 8" },
                                { label: "Descanso", valor: fila?.descanso ?? "—" },
                              ].map((campo) => (
                                <div key={campo.label} style={{ padding: 9, borderRadius: 10, border: "1px solid rgba(233,233,237,.12)", textAlign: "center" }}>
                                  <div style={{ fontSize: 10, textTransform: "uppercase", opacity: .45 }}>{campo.label}</div>
                                  <div style={{ fontSize: 15 }}>{campo.valor}</div>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={() => marcarHecho(b.id, semanaActual)}
                              disabled={hecho}
                              className="btn btn-ghost"
                              style={{ marginTop: 10 }}
                            >
                              <i className="ph ph-check-circle" /> {hecho ? "Hecho" : "Marcar como hecho"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: 16, padding: 15, borderRadius: 12, border: "1px dashed var(--color-neutral-700)", fontSize: 13, lineHeight: 1.5, opacity: .78, maxWidth: 720 }}>
                    <b>Nota de Beto:</b> si una serie te sale con técnica pobre, quedate en la carga de la semana anterior: la progresión es una guía, no una obligación.
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {vals.tabPaquetes && (
          <div>
            <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 18px" }}>Mis paquetes</h2>
            <div style={{ padding: 20, borderRadius: 14, background: "linear-gradient(120deg,var(--color-accent-900),var(--color-surface))", maxWidth: 520 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, letterSpacing: "-0.02em" }}>Mensualidad</div>
                <span className="tag tag-outline">Ver precios</span>
              </div>
              <div style={{ fontSize: 13, opacity: .7, marginTop: 10 }}>Todas las grupales + 1 personalizada por semana.</div>
              <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
                <button onClick={vals.goPrecios} className="btn btn-primary">Ver precios</button>
                <button onClick={vals.goReservar} className="btn btn-secondary">Usar una clase</button>
              </div>
            </div>
            <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "30px 0 12px" }}>Pagos</h3>
            <table className="table" style={{ maxWidth: 720 }}>
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Medio</th><th style={{ textAlign: "right" }}>Importe</th></tr></thead>
              <tbody>
                {vals.pagos.map((p) => (
                  <tr key={p.fecha}><td>{p.fecha}</td><td>{p.concepto}</td><td>{p.medio}</td><td style={{ textAlign: "right" }}>{p.importe}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {vals.tabDatos && (
          <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 18px" }}>Mis datos</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                <div className="field"><label>Nombre y apellido</label><input className="input" defaultValue="Camila Ferreyra" readOnly /></div>
                <div className="field"><label>Email</label><input className="input" defaultValue="camila.f@gmail.com" readOnly /></div>
                <div className="field"><label>Objetivo actual</label><input className="input" defaultValue="Volver a correr sin dolor de rodilla" readOnly /></div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Sesiones activas</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sesiones.length === 0 && (
                  <div style={{ fontSize: 13.5, opacity: .55 }}>Cargando sesiones…</div>
                )}
                {sesiones.map((s) => {
                  const actual = s.id === actualId;
                  return (
                    <div key={s.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 15px", borderRadius: 12, background: "var(--color-surface)", border: actual ? `1px solid ${"var(--color-accent)"}` : "1px solid transparent" }}>
                      <i className="ph ph-device-mobile" style={{ fontSize: 18, color: actual ? "var(--color-accent)" : "rgba(233,233,237,.6)" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{s.userAgent || "Navegador"}{actual ? " · esta sesión" : ""}</div>
                        <div style={{ fontSize: 12, opacity: .55, marginTop: 2 }}>{s.ip || "IP desconocida"} · {new Date(s.createdAt).toLocaleString("es-AR")}</div>
                      </div>
                      {actual && <span className="tag tag-accent">Actual</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                <button onClick={cerrarTodas} className="btn btn-secondary" style={{ alignSelf: "flex-start" }}><i className="ph ph-sign-out" style={{ fontSize: 16 }} /> Cerrar en todos los dispositivos</button>
                {cerrandoMsg && <div style={{ fontSize: 13, color: "#a9d39a" }}>{cerrandoMsg}</div>}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Cambiar contraseña</h3>
              <form onSubmit={cambiarClave} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                <div className="field"><label>Contraseña actual</label><input className="input" type="password" value={actual} onChange={(e) => setActual(e.target.value)} required /></div>
                <div className="field"><label>Nueva contraseña</label><input className="input" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Mínimo 10 caracteres, letras y números" required minLength={10} /></div>
                {passMsg && <div style={{ fontSize: 13, color: passMsg === "Contraseña actualizada" ? "#a9d39a" : "#e5a3a3" }}>{passMsg}</div>}
                <button className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Guardar nueva contraseña</button>
              </form>
            </div>
          </div>
        )}

        {vals.tabNotis && (
          <div style={{ maxWidth: 680 }}>
            <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 18px" }}>Notificaciones</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {vals.notis.map((n) => (
                <div key={n.titulo} style={{ display: "flex", gap: 13, padding: 15, borderRadius: 12, background: n.bg }}>
                  <i className={`ph ${n.icon}`} style={{ fontSize: 20, color: "var(--color-accent)", marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{n.titulo}</div>
                    <div style={{ fontSize: 12.5, opacity: .6, marginTop: 3, lineHeight: 1.45, textWrap: "pretty" }}>{n.texto}</div>
                  </div>
                  <div style={{ fontSize: 11.5, opacity: .4, whiteSpace: "nowrap" }}>{n.cuando}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
