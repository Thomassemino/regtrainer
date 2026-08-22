import type { BetoVals } from "@/hooks/useBetoApp";
import ImageSlot from "@/components/ImageSlot";

export default function Cuenta({ vals }: { vals: BetoVals }) {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 72px", display: "grid", gridTemplateColumns: "236px 1fr", gap: 28, alignItems: "start" }}>
      <div style={{ position: "sticky", top: 86, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <ImageSlot alt="Camila Ferreyra" shape="circle" style={{ width: 44, height: 44, flex: "none" }} initials="CF" />
          <div><div style={{ fontSize: 14.5, fontWeight: 500 }}>Camila Ferreyra</div><div style={{ fontSize: 11.5, opacity: .5 }}>Bono 8 · {vals.creditos} clases</div></div>
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
                <div key={r.dow + r.num} style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 18px", borderRadius: 14, background: "var(--color-surface)", opacity: r.op }}>
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
            <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Mi rutina</h2>
            <p style={{ fontSize: 13.5, opacity: .6, margin: "0 0 18px" }}>Fuerza · Bloque 2 de 4 · semana 5 · asignada por Beto el 03/08</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {vals.diasRutina.map((d) => (
                <button key={d.label} onClick={d.onClick} style={{ cursor: "pointer", fontSize: 13, padding: "9px 15px", borderRadius: 99, border: `1px solid ${d.bd}`, background: d.bg, color: d.fg }}>{d.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 720 }}>
              {vals.ejercicios.map((e) => (
                <div key={e.nombre} onClick={e.onToggle} style={{ cursor: "pointer", display: "flex", gap: 13, alignItems: "center", padding: "14px 16px", borderRadius: 12, background: "var(--color-surface)" }}>
                  <span style={{ width: 22, height: 22, flex: "none", borderRadius: 6, border: `1.5px solid ${e.chkBd}`, background: e.chkBg, display: "grid", placeItems: "center" }}>
                    <i className="ph ph-check" style={{ fontSize: 13, color: e.chkFg }} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500, textDecoration: e.deco }}>{e.nombre}</div>
                    <div style={{ fontSize: 12.5, opacity: .55, marginTop: 2 }}>{e.detalle}</div>
                  </div>
                  <button className="btn btn-ghost"><i className="ph ph-play-circle" style={{ fontSize: 18 }} /> Ver video</button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: 15, borderRadius: 12, border: "1px dashed var(--color-neutral-700)", fontSize: 13, lineHeight: 1.5, opacity: .78, maxWidth: 720, textWrap: "pretty" }}>
              <b>Nota de Beto:</b> si el press te queda liviano subí 2,5 kg y avisame por WhatsApp cómo salió.
            </div>
          </div>
        )}

        {vals.tabPaquetes && (
          <div>
            <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 18px" }}>Mis paquetes</h2>
            <div style={{ padding: 20, borderRadius: 14, background: "linear-gradient(120deg,var(--color-accent-900),var(--color-surface))", maxWidth: 520 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, letterSpacing: "-0.02em" }}>Bono 8 clases</div>
                <span className="tag tag-outline">Activo</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: "var(--color-neutral-900)", overflow: "hidden", margin: "14px 0 8px" }}><div style={{ height: "100%", width: vals.creditosPct, background: "var(--color-accent)" }} /></div>
              <div style={{ fontSize: 13, opacity: .7 }}>{vals.creditos} de 8 clases disponibles · vence el 30/09/2026</div>
              <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
                <button onClick={vals.goPrecios} className="btn btn-primary">Renovar con 10% off</button>
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
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 18px" }}>Mis datos</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div className="field"><label>Nombre y apellido</label><input className="input" defaultValue="Camila Ferreyra" readOnly /></div>
              <div className="field"><label>Email</label><input className="input" defaultValue="camila.f@gmail.com" readOnly /></div>
              <div className="field"><label>WhatsApp</label><input className="input" defaultValue="+54 9 11 6123-4488" readOnly /></div>
              <div className="field"><label>Objetivo actual</label><input className="input" defaultValue="Volver a correr sin dolor de rodilla" readOnly /></div>
              <div className="field"><label>Notas médicas para Beto</label><textarea className="input" readOnly defaultValue="Condromalacia rotuliana leve (2024). Sin impacto alto en días consecutivos." /></div>
              <button className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Guardar cambios</button>
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
