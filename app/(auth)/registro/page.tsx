"use client";
import { useState } from "react";
import GoogleButton from "@/components/GoogleButton";

export default function RegistroPage() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, password }),
      });
      if (res.ok) {
        setEnviado(true);
      } else {
        const data = await res.json();
        setError(data.error ?? "No pudimos completar el registro");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(28px, 6vw, 56px) clamp(16px, 4vw, 32px) clamp(48px, 8vw, 80px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: "clamp(28px, 5vw, 48px)", alignItems: "center" }}>
      <div style={{ maxWidth: "44ch" }}>
        <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-accent)" }}>Primera vez</div>
        <h1 style={{ fontSize: "clamp(30px, 7vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.035em", margin: "12px 0 0" }}>Creá tu cuenta</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, opacity: .7, margin: "14px 0 0", textWrap: "pretty" }}>
          Te lleva un minuto. Con tu cuenta reservás clases, pagás online y ves la rutina que te asigna Beto.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 24 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.45 }}>
            <i className="ph ph-ticket" style={{ fontSize: 17, color: "var(--color-accent)", marginTop: 1 }} />
            <span style={{ opacity: .8 }}>Reservás y pagás tu clase o tu mensualidad online</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.45 }}>
            <i className="ph ph-barbell" style={{ fontSize: 17, color: "var(--color-accent)", marginTop: 1 }} />
            <span style={{ opacity: .8 }}>Ves la rutina que te asignó Beto</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.45 }}>
            <i className="ph ph-receipt" style={{ fontSize: 17, color: "var(--color-accent)", marginTop: 1 }} />
            <span style={{ opacity: .8 }}>Historial de pagos y comprobantes</span>
          </div>
        </div>
      </div>

      <div style={{ width: "min(420px, 100%)", padding: "clamp(18px, 5vw, 24px)", borderRadius: 14, background: "var(--color-surface)", boxShadow: "var(--shadow-md)", display: "flex", flexDirection: "column", gap: 14 }}>
        {enviado ? (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(136,180,113,.12)", border: "1px solid rgba(136,180,113,.35)", fontSize: 13, color: "#a9d39a" }}>
            Te mandamos un email para confirmar tu cuenta. Revisá tu bandeja de entrada.
          </div>
        ) : (
          <>
            <GoogleButton label="Crear cuenta con Google" />
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, opacity: .45 }}><span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />o<span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} /></div>

            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field"><label>Nombre</label><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required /></div>
              <div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required /></div>
              <div className="field"><label>Contraseña</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" required minLength={10} /></div>

              <div style={{ fontSize: 12.5, color: "#e5a3a3", display: error ? "block" : "none" }}>{error}</div>

              <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 44, fontSize: 15 }}>Crear cuenta</button>

              <div style={{ fontSize: 11.5, opacity: .45, lineHeight: 1.45, textWrap: "pretty" }}>Mínimo 10 caracteres, combinando letras y números.</div>

              <div style={{ fontSize: 12.5, opacity: .65, textAlign: "center" }}>
                ¿Ya tenés cuenta? <a href="/login">Ingresá</a>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
