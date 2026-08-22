"use client";

import { useEffect, useMemo, useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ClienteFilaApi } from "@/lib/types";
import ImageSlot from "@/components/ImageSlot";

export default function Clientes({ vals }: { vals: BetoVals }) {
  const [clientes, setClientes] = useState<ClienteFilaApi[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/coach/clientes")
      .then((r) => r.json())
      .then((data) => setClientes(data.clientes ?? []))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q) || c.objetivo.toLowerCase().includes(q));
  }, [clientes, busqueda]);

  const formatFecha = (iso: string | null) => {
    if (!iso) return "Sin plan";
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
    if (dias <= 0) return "Hoy";
    if (dias === 1) return "Hace 1 día";
    if (dias < 7) return `Hace ${dias} días`;
    const semanas = Math.floor(dias / 7);
    return semanas === 1 ? "Hace 1 semana" : `Hace ${semanas} semanas`;
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 72px" }}>
      <button onClick={vals.goCoach} className="btn btn-ghost" style={{ marginBottom: 14 }}>
        <i className="ph ph-arrow-left" /> Panel
      </button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-accent)" }}>Modo entrenador</div>
          <h1 style={{ fontSize: 38, letterSpacing: "-0.03em", margin: "8px 0 0" }}>Clientes</h1>
          <p style={{ fontSize: 13.5, opacity: 0.6, margin: "6px 0 0" }}>
            Entrá a la ficha de cada uno para armarle la rutina, asignarla y exportarla.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="input"
            style={{ width: 240 }}
            placeholder="Buscar cliente"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button
            onClick={vals.goAsignar}
            className="btn btn-secondary"
            disabled={!vals.programaIdActivo}
            title={vals.programaIdActivo ? undefined : "Primero abrí o creá un programa desde la ficha de un cliente"}
          >
            <i className="ph ph-users-three" /> Asignación masiva
          </button>
        </div>
      </div>

      {cargando ? (
        <div style={{ fontSize: 13.5, opacity: 0.55 }}>Cargando clientes…</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th><th>Plan</th><th>Programa actual</th><th>Última actualización</th><th style={{ textAlign: "right" }}>Rutina</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ImageSlot alt={c.nombre} shape="circle" style={{ width: 32, height: 32, flex: "none" }} initials={c.iniciales} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.nombre}</div>
                      <div style={{ fontSize: 12, opacity: 0.5 }}>{c.objetivo}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 13.5, opacity: 0.75 }}>{c.plan}</td>
                <td><span className={`tag ${c.programaEstado ? "tag-accent" : "tag-outline"}`}>{c.programaActual}</span></td>
                <td style={{ fontSize: 13, opacity: 0.6 }}>{formatFecha(c.actualizadoEn)}</td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => vals.goFicha(c.id)} className="btn btn-secondary">Abrir ficha</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}