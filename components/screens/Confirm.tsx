import type { BetoVals } from "@/hooks/useBetoApp";

export default function Confirm({ vals }: { vals: BetoVals }) {
  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "clamp(40px,10vw,72px) clamp(16px,4vw,32px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, animation: "betoIn .35s ease both" }}>
      <div style={{ width: 86, height: 86, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--color-accent-900)", boxShadow: "0 0 0 12px rgba(232,40,40,.09)" }}>
        <i className="ph-fill ph-check" style={{ fontSize: 40, color: "var(--color-accent)" }} />
      </div>
      <h1 style={{ fontSize: "clamp(27px,7vw,36px)", letterSpacing: "-0.03em", margin: 0, textAlign: "center" }}>¡Turno confirmado!</h1>
      <p style={{ fontSize: 15, opacity: .65, margin: 0, textAlign: "center", textWrap: "pretty" }}>Te mandamos el comprobante por mail y un recordatorio 2 horas antes de la clase.</p>
      <div style={{ width: "100%", padding: 20, borderRadius: 14, background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 10 }}>
        {vals.confirmItems.map((r) => (
          <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 14 }}><span style={{ opacity: .6 }}>{r.k}</span><span style={{ fontWeight: 500, textAlign: "right" }}>{r.v}</span></div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
        <button onClick={vals.goCuenta} className="btn btn-primary" style={{ height: 44, paddingInline: 20 }}>Ver mis reservas</button>
        <button onClick={vals.goReservar} className="btn btn-secondary" style={{ height: 44, paddingInline: 20 }}>Reservar otra clase</button>
      </div>
    </div>
  );
}
