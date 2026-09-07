"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function ResetearPasswordInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth/resetear-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setMensaje(res.ok ? "Contraseña actualizada, ya podés ingresar." : data.error);
  };

  return (
    <div className="rt-container" style={{ paddingBlock: "clamp(28px, 6vw, 56px)" }}>
      <form onSubmit={onSubmit} className="field" style={{ width: "min(440px, 100%)" }}>
        <input className="input" type="password" placeholder="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
        <button className="btn btn-primary" type="submit" style={{ marginTop: 12 }}>Guardar nueva contraseña</button>
        {mensaje && <p>{mensaje}</p>}
      </form>
    </div>
  );
}

export default function ResetearPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetearPasswordInner />
    </Suspense>
  );
}