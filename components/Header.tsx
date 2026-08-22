import type { BetoVals } from "@/hooks/useBetoApp";

export default function Header({ vals }: { vals: BetoVals }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(22,24,38,.88)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--color-divider)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 32px", display: "flex", alignItems: "center", gap: 28 }}>
        <div onClick={vals.goLanding} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 9, marginRight: 8 }}>
          <span style={{ width: 26, height: 26, border: "1px solid var(--color-accent)", borderRadius: 7, display: "grid", placeItems: "center", color: "var(--color-accent)" }}>
            <i className="ph ph-barbell" style={{ fontSize: 15 }} />
          </span>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 17, letterSpacing: "-0.02em" }}>Beto Training</span>
        </div>
        <div style={{ display: "flex", gap: 22, alignItems: "center", flex: 1 }}>
          {vals.navLinks.map((n) => (
            <a key={n.label} href={n.href} onClick={n.onClick} style={{ cursor: "pointer", fontSize: 14, color: n.fg }}>{n.label}</a>
          ))}
        </div>
        <button onClick={vals.goCuenta} className="btn btn-secondary"><i className="ph ph-user-circle" /> {vals.cuentaLabel}</button>
        <button onClick={vals.logout} className="btn btn-ghost" style={{ display: vals.logoutShow as "inline-flex" | "none" }}>Salir</button>
        <button onClick={vals.goReservar} className="btn btn-primary">Reservar clase</button>
      </div>
    </div>
  );
}
