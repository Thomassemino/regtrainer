"use client";

import { useState } from "react";

export default function OlvidarPasswordPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/olvide-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      setEnviado(true);
    } else {
      setError(data.error ?? "No pudimos procesar la solicitud");
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(28px, 6vw, 56px) clamp(16px, 4vw, 32px) clamp(48px, 8vw, 80px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: "clamp(28px, 5vw, 48px)", alignItems: "center" }}>
      <div style={{ maxWidth: "44ch" }}>
        <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-accent)" }}>Recuperación</div>
        <h1 style={{ fontSize: "clamp(30px, 7vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.035em", margin: "12px 0 0" }}>Olvidaste tu contraseña</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, opacity: .7, margin: "14px 0 0", textWrap: "pretty" }}>
          Te mandamos un link por email para que elijas una nueva contraseña. El link vence en 1 hora.
        </p>
      </div>

      <div style={{ width: "min(420px, 100%)", padding: "clamp(18px, 5vw, 24px)", borderRadius: 14, background: "var(--color-surface)", boxShadow: "var(--shadow-md)", display: "flex", flexDirection: "column", gap: 14 }}>
        {enviado && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(136,180,113,.12)", fontSize: 13, color: "#a9d39a" }}>
            Si el email existe, te llegó un correo
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required /></div>
          <div style={{ fontSize: 12.5, color: "#e5a3a3", display: error ? "block" : "none" }}>{error}</div>
          <button type="submit" className="btn btn-primary btn-block" style={{ height: 44, fontSize: 15 }}>Enviar link de recuperación</button>
          <div style={{ fontSize: 12.5, opacity: .65, textAlign: "center" }}>
            <a href="/login">Volver al login</a>
          </div>
        </form>
      </div>
    </div>
  );
}