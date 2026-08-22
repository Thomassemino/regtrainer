"use client";
import { useState } from "react";

export default function RegistroPage() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/registro", {
      method: "POST",
      body: JSON.stringify({ nombre, email, password }),
    });
    if (res.ok) {
      setEnviado(true);
    } else {
      const data = await res.json();
      setError(data.error ?? "No pudimos completar el registro");
    }
  };

  if (enviado) {
    return <p>Te mandamos un email para confirmar tu cuenta. Revisá tu bandeja de entrada.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="field">
      <input className="input" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit">Crear cuenta</button>
    </form>
  );
}