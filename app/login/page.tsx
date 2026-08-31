"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import GoogleButton from "@/components/GoogleButton";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, data: session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      if (!session?.user) {
        void signOut({ redirect: false });
        return;
      }
      router.push("/");
    }
  }, [status, session, router]);

  const verificado = params.get("verificado") === "1";
  const tokenError = params.get("error") === "token_invalido" || params.get("error") === "token_expirado";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result || result.error) {
        setError("Email o contraseña incorrectos");
        return;
      }
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 32px 80px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
      <div style={{ maxWidth: "44ch" }}>
        <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-accent)" }}>Acceso</div>
        <h1 style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: "-0.035em", margin: "12px 0 0" }}>Entrá a tu cuenta</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, opacity: .7, margin: "14px 0 0", textWrap: "pretty" }}>
          Tus reservas, tu rutina, tu mensualidad y tus pagos en un solo lugar. Si ya compraste una clase, ya tenés cuenta.
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

      <div style={{ maxWidth: 420, width: "100%", padding: 24, borderRadius: 14, background: "var(--color-surface)", boxShadow: "var(--shadow-md)", display: "flex", flexDirection: "column", gap: 14 }}>
        {verificado && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(136,180,113,.12)", border: "1px solid rgba(136,180,113,.35)", fontSize: 13, color: "#a9d39a" }}>
            Cuenta verificada, ya podés ingresar.
          </div>
        )}
        {tokenError && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(229,163,163,.1)", border: "1px solid rgba(229,163,163,.3)", fontSize: 13, color: "#e5a3a3" }}>
            El link de verificación venció o ya fue usado. Iniciá sesión para pedir uno nuevo.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required /></div>
          <div className="field"><label>Contraseña</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
            <a href="/olvidar-password" style={{ fontSize: 12.5 }}>Olvidaste la contraseña</a>
          </div>

          <div style={{ fontSize: 12.5, color: "#e5a3a3", display: error ? "block" : "none" }}>{error}</div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 44, fontSize: 15 }}>Ingresar</button>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, opacity: .45 }}><span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />o<span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} /></div>
            <GoogleButton />
            <div style={{ fontSize: 12.5, opacity: .65, textAlign: "center" }}>
              ¿No tenés cuenta? <a href="/registro">Registrate</a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}