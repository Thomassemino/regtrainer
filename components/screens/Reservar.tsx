import type { BetoVals } from "@/hooks/useBetoApp";

export default function Reservar({ vals }: { vals: BetoVals }) {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 72px" }}>
      <h1 style={{ fontSize: 40, letterSpacing: "-0.03em", margin: 0 }}>Reservá tu turno</h1>
      <p style={{ fontSize: 14, opacity: .6, margin: "8px 0 28px" }}>Elegí la clase, el día y el horario. Podés pagar con tarjeta, Mercado Pago o en el estudio.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 348px", gap: 28, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent)", marginBottom: 11 }}>1 · Clase</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {vals.chipsServicio.map((c) => (
                <button key={c.label} onClick={c.onClick} style={{ cursor: "pointer", fontSize: 13.5, padding: "9px 16px", borderRadius: 99, border: `1px solid ${c.bd}`, background: c.bg, color: c.fg }}>{c.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 11 }}>
              <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent)" }}>2 · Día</div>
              <div style={{ fontSize: 12.5, opacity: .5 }}>Agosto 2026</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
              {vals.dias.map((d, i) => (
                <button key={i} onClick={d.onClick} style={{ cursor: "pointer", padding: "12px 0", borderRadius: 12, border: `1px solid ${d.bd}`, background: d.bg, color: d.fg, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", opacity: .65 }}>{d.dow}</span>
                  <span style={{ fontFamily: "var(--font-heading)", fontSize: 21, lineHeight: 1 }}>{d.num}</span>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: d.dot }} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent)", marginBottom: 11 }}>3 · Horario</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 9 }}>
              {vals.horarios.map((h) => (
                <button key={h.hora} onClick={h.onClick} disabled={!h.onClick} style={{ cursor: h.cursor as "pointer" | "not-allowed", padding: "13px 6px", borderRadius: 12, border: `1px solid ${h.bd}`, background: h.bg, color: h.fg, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontFamily: "var(--font-heading)", fontSize: 17, lineHeight: 1 }}>{h.hora}</span>
                  <span style={{ fontSize: 11, opacity: .6 }}>{h.cupos}</span>
                </button>
              ))}
            </div>
          </div>
          <label style={{ display: "flex", gap: 11, alignItems: "center", padding: 15, borderRadius: 12, background: "var(--color-surface)", cursor: "pointer", maxWidth: 520 }}>
            <input type="checkbox" checked={vals.recurrente} onChange={vals.toggleRecurrente} style={{ width: 17, height: 17, accentColor: "var(--color-accent)" }} />
            <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.4 }}>Repetir todas las semanas<br /><span style={{ fontSize: 12, opacity: .5 }}>Reserva el mismo día y horario durante las próximas 4 semanas</span></span>
          </label>
        </div>

        <div style={{ position: "sticky", top: 86, padding: 20, borderRadius: 14, background: "var(--color-surface)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent)" }}>Tu reserva</div>
          {vals.resumenItems.map((r) => (
            <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 13.5 }}><span style={{ opacity: .6 }}>{r.k}</span><span style={{ fontWeight: 500, textAlign: "right" }}>{r.v}</span></div>
          ))}
          <div style={{ height: 1, background: "var(--color-divider)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13.5, opacity: .6 }}>A pagar</span>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 26, letterSpacing: "-0.03em" }}>{vals.resumenPrecio}</span>
          </div>
          <div style={{ fontSize: 12, opacity: .55, lineHeight: 1.45 }}>
            {vals.cargandoHorarios ? "Buscando horarios disponibles…" : ""}
          </div>
          <button onClick={vals.irCheckout} className="btn btn-primary btn-block" style={{ height: 44, fontSize: 15 }}>Continuar al pago</button>
          <div style={{ display: "flex", gap: 7, alignItems: "center", justifyContent: "center", fontSize: 11.5, opacity: .5 }}><i className="ph ph-lock-simple" />Cancelación sin costo hasta 6 h antes</div>
        </div>
      </div>
    </div>
  );
}
