"use client";

import { useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";

export default function Header({ vals }: { vals: BetoVals }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(0,0,0,.9)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--color-divider)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px clamp(16px,4vw,32px)", display: "flex", alignItems: "center", gap: 28 }}>
        <div onClick={() => { setOpen(false); vals.goLanding(); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 9, marginRight: 8 }}>
          <img src="/img/regtrainer-runner.png" alt="RegTrainer" style={{ width: 22, height: 33, objectFit: "contain" }} />
          <span style={{ fontFamily: "var(--font-heading)", fontStyle: "italic", fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em" }}>
            <span style={{ color: "#FFFFFF" }}>REG</span><span style={{ color: "var(--color-accent)" }}>TRAINER</span>
          </span>
        </div>
        <div className="rt-hide-md" style={{ display: "flex", alignItems: "center", gap: 28, flex: 1 }}>
          <div style={{ display: "flex", gap: 22, alignItems: "center", flex: 1 }}>
            {vals.navLinks.map((n) => (
              <a key={n.label} href={n.href} onClick={n.onClick} style={{ cursor: "pointer", fontSize: 14, color: n.fg }}>{n.label}</a>
            ))}
          </div>
          <button onClick={vals.goCuenta} className="btn btn-secondary"><i className="ph ph-user-circle" /> {vals.cuentaLabel}</button>
          <button onClick={vals.logout} className="btn btn-ghost" style={{ display: vals.logoutShow as "inline-flex" | "none" }}>Salir</button>
          <button onClick={vals.goReservar} className="btn btn-primary" style={{ display: vals.reservarClaseShow as "inline-flex" | "none" }}>Reservar clase</button>
        </div>
        <button
          className="rt-show-md"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 8, border: "1px solid var(--color-divider)", background: "transparent", color: "var(--color-text)", cursor: "pointer" }}
        >
          <i className={`ph ${open ? "ph-x" : "ph-list"}`} style={{ fontSize: 22 }} />
        </button>
      </div>
      {open && (
        <div className="rt-show-md" style={{ borderTop: "1px solid var(--color-divider)", background: "rgba(0,0,0,.95)" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px clamp(16px,4vw,32px) 18px", display: "flex", flexDirection: "column", gap: 4 }}>
            {vals.navLinks.map((n) => (
              <a
                key={n.label}
                href={n.href}
                onClick={() => { setOpen(false); n.onClick?.(); }}
                style={{ cursor: "pointer", fontSize: 15, color: n.fg, padding: "10px 2px", borderBottom: "1px solid var(--color-divider)" }}
              >
                {n.label}
              </a>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <button onClick={() => { setOpen(false); vals.goCuenta(); }} className="btn btn-secondary btn-block"><i className="ph ph-user-circle" /> {vals.cuentaLabel}</button>
              <button onClick={() => { setOpen(false); vals.logout(); }} className="btn btn-ghost btn-block" style={{ display: vals.logoutShow as "inline-flex" | "none" }}>Salir</button>
              <button onClick={() => { setOpen(false); vals.goReservar(); }} className="btn btn-primary btn-block" style={{ display: vals.reservarClaseShow as "inline-flex" | "none" }}>Reservar clase</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
