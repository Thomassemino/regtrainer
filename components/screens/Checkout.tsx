import type { BetoVals } from "@/hooks/useBetoApp";

export default function Checkout({ vals }: { vals: BetoVals }) {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 72px" }}>
      <button onClick={vals.back} className="btn btn-ghost" style={{ marginBottom: 10 }}><i className="ph ph-arrow-left" /> Volver</button>
      <h1 style={{ fontSize: 40, letterSpacing: "-0.03em", margin: "0 0 28px" }}>Confirmar y pagar</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 348px", gap: 28, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent)" }}>Forma de pago</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {vals.metodos.map((m) => (
              <button key={m.id} onClick={m.onClick} style={{ cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: 15, borderRadius: 12, border: `1px solid ${m.bd}`, background: m.bg, color: "var(--color-text)" }}>
                <i className={`ph ${m.icon}`} style={{ fontSize: 22, color: "var(--color-accent)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{m.label}</div>
                  <div style={{ fontSize: 12, opacity: .55, marginTop: 2 }}>{m.sub}</div>
                </div>
                <span style={{ width: 17, height: 17, flex: "none", borderRadius: "50%", border: `1.5px solid ${m.dotBd}`, background: m.dotBg, boxShadow: m.dotIn }} />
              </button>
            ))}
          </div>
          {vals.mostrarTarjeta && (
            <div style={{ padding: 20, borderRadius: 14, border: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
              <div className="field"><label>Nombre en la tarjeta</label><input className="input" defaultValue="Camila Ferreyra" readOnly /></div>
              <div className="field"><label>Número de tarjeta</label><input className="input" defaultValue="4509 9535 6623 3704" readOnly /></div>
              <div style={{ display: "flex", gap: 12 }}>
                <div className="field" style={{ flex: 1 }}><label>Vencimiento</label><input className="input" defaultValue="09/29" readOnly /></div>
                <div className="field" style={{ flex: 1 }}><label>CVV</label><input className="input" defaultValue="•••" readOnly /></div>
                <div className="field" style={{ flex: 1 }}><label>DNI</label><input className="input" defaultValue="38.221.904" readOnly /></div>
              </div>
              <div className="field"><label>Cuotas</label>
                <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                  {vals.cuotas.map((c) => (
                    <button key={c.label} onClick={c.onClick} style={{ cursor: "pointer", flex: 1, fontSize: 13, padding: "10px 0", borderRadius: 9, border: `1px solid ${c.bd}`, background: c.bg, color: c.fg }}>{c.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <p style={{ fontSize: 12.5, opacity: .55 }}>
            Vas a recibir un comprobante simple por email — no es una factura fiscal (sin AFIP).
          </p>
        </div>
        <div style={{ position: "sticky", top: 86, padding: 20, borderRadius: 14, background: "var(--color-surface)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent)" }}>Resumen</div>
          {vals.checkoutItems.map((r) => (
            <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 13.5 }}><span style={{ opacity: .6 }}>{r.k}</span><span style={{ fontWeight: 500, textAlign: "right" }}>{r.v}</span></div>
          ))}
          <div style={{ height: 1, background: "var(--color-divider)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13.5, opacity: .6 }}>Total</span>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 26, letterSpacing: "-0.03em" }}>{vals.totalFmt}</span>
          </div>
          <button onClick={vals.pagar} className="btn btn-primary btn-block" style={{ height: 44, fontSize: 15 }}>{vals.ctaPago}</button>
          <div style={{ display: "flex", gap: 7, alignItems: "center", justifyContent: "center", fontSize: 11.5, opacity: .5 }}><i className="ph ph-lock-simple" />Pago protegido</div>
        </div>
      </div>
    </div>
  );
}
