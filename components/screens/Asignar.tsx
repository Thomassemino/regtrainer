"use client";

import { useEffect, useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ClienteFilaApi, ProgramaApi } from "@/lib/types";
import ImageSlot from "@/components/ImageSlot";

export default function Asignar({ vals }: { vals: BetoVals }) {
  const [clientes, setClientes] = useState<ClienteFilaApi[]>([]);
  const [programa, setPrograma] = useState<ProgramaApi | null>(null);
  const [mensaje, setMensaje] = useState("Arrancamos el bloque nuevo. Cualquier duda me escribís.");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/coach/clientes").then((r) => r.json()).then((d) => setClientes(d.clientes ?? []));
    if (vals.programaIdActivo) {
      fetch(`/api/coach/programas/${vals.programaIdActivo}`).then((r) => r.json()).then((d) => setPrograma(d.programa ?? null));
    }
  }, [vals.programaIdActivo]);

  const seleccionados = clientes.filter((c) => vals.asignadosSel[c.id]);
  const todosSeleccionados = clientes.length > 0 && seleccionados.length === clientes.length;

  const alternarTodos = () => {
    clientes.forEach((c) => {
      if (todosSeleccionados ? vals.asignadosSel[c.id] : !vals.asignadosSel[c.id]) {
        vals.toggleAsignado(c.id);
      }
    });
  };

  const asignar = async () => {
    if (!vals.programaIdActivo || seleccionados.length === 0) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/coach/programas/${vals.programaIdActivo}/asignar`, {
        method: "POST",
        body: JSON.stringify({ clienteIds: seleccionados.map((c) => c.id), mensajePersonalizado: mensaje, temaPdf: vals.temaPdfSel }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        vals.showToast(`Programa asignado a ${data.asignados} clientes`);
        vals.goPdf();
      } else {
        vals.showToast(data?.error ?? "No se pudo asignar el programa");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ padding: "32px 32px 72px" }}>
      <button onClick={() => vals.programaIdActivo && vals.goBuilder(vals.programaIdActivo)} className="btn btn-ghost" style={{ marginBottom: 14 }}>
        <i className="ph ph-arrow-left" /> Volver al constructor
      </button>
      <h1 style={{ fontSize: 34, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Asignar «{programa?.nombre ?? "…"}»</h1>
      <p style={{ fontSize: 13.5, opacity: 0.6, margin: "0 0 24px" }}>
        El mismo programa a varios clientes, sin reescribirlo. Cada uno lo ve en su cuenta y lo recibe en PDF.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 18, letterSpacing: "-0.02em", margin: 0 }}>Elegí a quién se lo asignás</h3>
            <button onClick={alternarTodos} className="btn btn-ghost">{todosSeleccionados ? "Deseleccionar todos" : "Seleccionar todos"}</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clientes.map((c) => {
              const on = !!vals.asignadosSel[c.id];
              return (
                <div
                  key={c.id}
                  onClick={() => vals.toggleAsignado(c.id)}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 12, background: "var(--color-surface)", border: `1px solid ${on ? "var(--color-accent)" : "transparent"}` }}
                >
                  <span style={{ width: 22, height: 22, flex: "none", borderRadius: 6, border: "1.5px solid var(--color-divider)", background: on ? "var(--color-accent)" : "transparent", display: "grid", placeItems: "center" }}>
                    {on && <i className="ph ph-check" style={{ fontSize: 13, color: "#000" }} />}
                  </span>
                  <ImageSlot alt={c.nombre} shape="circle" style={{ width: 32, height: 32, flex: "none" }} src={c.imagen ?? undefined} initials={c.iniciales} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{c.nombre}</div>
                    <div style={{ fontSize: 12, opacity: 0.55 }}>{c.objetivo}</div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.45 }}>{c.plan}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ position: "sticky", top: 86, padding: 20, borderRadius: 14, background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent)" }}>Resumen</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Programa</span><span>{programa?.nombre ?? "…"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Duración</span><span>{programa?.semanas ?? "—"} semanas</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Asignados</span><span>{seleccionados.length} clientes</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Marca del PDF</span><span>RegTrainer</span></div>
          </div>
          <div className="field">
            <label>Mensaje para tus clientes</label>
            <textarea className="input" style={{ minHeight: 80 }} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          </div>
          <button onClick={asignar} disabled={enviando || seleccionados.length === 0} className="btn btn-primary btn-block">
            {seleccionados.length === 0 ? "Elegí al menos un cliente" : `Asignar a ${seleccionados.length} clientes`}
          </button>
          <p style={{ fontSize: 11.5, opacity: 0.45, margin: 0 }}>Queda visible en «Mi rutina» de cada cliente y se genera el PDF con tu marca.</p>
        </div>
      </div>
    </div>
  );
}