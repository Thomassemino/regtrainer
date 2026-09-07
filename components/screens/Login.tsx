import { useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import GoogleButton from "@/components/GoogleButton";

export default function Login({ vals }: { vals: BetoVals }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await vals.entrar(email, password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(28px, 6vw, 56px) clamp(16px, 4vw, 32px) clamp(48px, 8vw, 80px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: "clamp(28px, 5vw, 48px)", alignItems: "center" }}>
      <div style={{ maxWidth: "44ch" }}>
        <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-accent)" }}>Acceso</div>
        <h1 style={{ fontSize: "clamp(30px, 7vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.035em", margin: "12px 0 0" }}>{vals.loginTitulo}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, opacity: .7, margin: "14px 0 0", textWrap: "pretty" }}>{vals.loginBajada}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 24 }}>
          {vals.loginBullets.map((b) => (
            <div key={b.t} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.45 }}>
              <i className={`ph ${b.icon}`} style={{ fontSize: 17, color: "var(--color-accent)", marginTop: 1 }} />
              <span style={{ opacity: .8 }}>{b.t}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: "min(420px, 100%)", padding: "clamp(18px, 5vw, 24px)", borderRadius: 14, background: "var(--color-surface)", boxShadow: "var(--shadow-md)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <img src="/img/regtrainer-runner.png" alt="RegTrainer" style={{ width: 16, height: 24, objectFit: "contain" }} />
          <span style={{ fontFamily: "var(--font-heading)", fontStyle: "italic", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>
            <span style={{ color: "#FFFFFF" }}>REG</span><span style={{ color: "var(--color-accent)" }}>TRAINER</span>
          </span>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field"><label>Email</label><input className="input" style={{ background: "var(--color-surface-sunken)" }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required /></div>
          <div className="field"><label>Contraseña</label><input className="input" style={{ background: "var(--color-surface-sunken)" }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <a href="/olvidar-password" className="btn btn-ghost" style={{ fontSize: 12.5 }}>Olvidé mi contraseña</a>
          </div>

          <div style={{ fontSize: 12.5, color: "#e5a3a3", display: vals.loginError ? "block" : "none" }}>{vals.loginError}</div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 44, fontSize: 15 }}>{vals.loginCta}</button>

          {!vals.auth && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, opacity: .45 }}><span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />o<span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} /></div>
              <GoogleButton />
              <div style={{ fontSize: 12.5, opacity: .65, textAlign: "center" }}>¿Primera vez? <a href="/registro">Creá tu cuenta en 1 minuto</a></div>
            </div>
          )}

          <div style={{ fontSize: 11.5, opacity: .45, lineHeight: 1.45, textWrap: "pretty" }}>{vals.loginNota}</div>
        </form>
      </div>
    </div>
  );
}