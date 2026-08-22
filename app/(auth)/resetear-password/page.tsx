"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetearPasswordPage() {
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
    <form onSubmit={onSubmit} className="field">
      <input className="input" type="password" placeholder="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
      <button className="btn btn-primary" type="submit">Guardar nueva contraseña</button>
      {mensaje && <p>{mensaje}</p>}
    </form>
  );
}