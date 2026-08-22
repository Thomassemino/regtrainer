"use client";

import { useEffect, useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import ImageSlot from "@/components/ImageSlot";

interface AsignacionFicha {
  id: string;
  asignadoEn: string;
  programa: { id: string; nombre: string; semanas: number; frecuencia: string; objetivo: string; estado: string };
}

interface ClienteFicha {
  id: string;
  nombre: string;
  iniciales: string;
  objetivo: string;
  plan: string;
  frecuencia: string | null;
  nivel: string | null;
  whatsapp: string | null;
  notaMedica: string | null;
  createdAt: string;
  asignaciones: AsignacionFicha[];
}

const ESTADO_LABEL: Record<string, { texto: string; clase: string }> = {
  BORRADOR: { texto: "En edición", clase: "tag-outline" },
  ASIGNADO: { texto: "Asignado", clase: "tag-accent" },
  COMPLETADO: { texto: "Completado", clase: "tag-neutral" },
  ARCHIVADO: { texto: "Archivado", clase: "tag-neutral" },
};

export default function Ficha({ vals }: { vals: BetoVals }) {
  const [cliente, setCliente] = useState<ClienteFicha | null>(null);
  const [cumplimiento, setCumplimiento] = useState<{ semana: number; porcentaje: number }[]>([]);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!vals.fichaId) return;
    fetch(`/api/coach/clientes/${vals.fichaId}`)
      .then((r) => r.json())
      .then((data) => {
        setCliente(data.cliente ?? null);
        setCumplimiento(data.cumplimiento ?? []);
      });
  }, [vals.fichaId]);

  const armarRutina = async () => {
    setCreando(true);
    try {
      const res = await fetch("/api/coach/programas", {
        method: "POST",
        body: JSON.stringify({
          nombre: "Nuevo programa",
          objetivo: cliente?.objetivo ?? "",
          frecuencia: "5 días semanales",
          semanas: 4,
          clienteId: cliente?.id,
        }),
      });
      const data = await res.json();
      if (res.ok) vals.goBuilder(data.programa.id);
    } finally {
      setCreando(false);
    }
  };

  const duplicarPrograma = async (programaId: string) => {
    const res = await fetch(`/api/coach/programas/${programaId}/duplicar`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      vals.showToast("Programa duplicado como borrador");
      vals.goBuilder(data.id);
    }
  };

  if (!cliente) {
    return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 32px 72px", fontSize: 13.5, opacity: 0.55 }}>Cargando ficha…</div>;
  }

  return (
    <div style={{ padding: "32px 32px 72px" }}>
      <button onClick={vals.goClientes} className="btn btn-ghost" style={{ marginBottom: 14 }}>
        <i className="ph ph-arrow-left" /> Clientes
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 28, alignItems: "start" }}>
        <div style={{ position: "sticky", top: 86, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 20, borderRadius: 14, background: "var(--color-surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ImageSlot alt={cliente.nombre} shape="circle" style={{ width: 52, height: 52, flex: "none" }} initials={cliente.iniciales} />
              <div>
                <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em" }}>{cliente.nombre}</div>
                <div style={{ fontSize: 12, opacity: 0.5 }}>{cliente.plan} · desde {new Date(cliente.createdAt).toLocaleDateString("es-AR", { month: "2-digit", year: "numeric" })}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ opacity: 0.55 }}>Objetivo</span><span>{cliente.objetivo}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ opacity: 0.55 }}>Frecuencia</span><span>{cliente.frecuencia ?? "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ opacity: 0.55 }}>Nivel</span><span>{cliente.nivel ?? "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ opacity: 0.55 }}>WhatsApp</span><span>{cliente.whatsapp ?? "—"}</span></div>
            </div>
            {cliente.notaMedica && (
              <div style={{ marginTop: 16, padding: 13, borderRadius: 10, border: "1px dashed var(--color-neutral-700)", fontSize: 12.5, opacity: 0.8 }}>
                <b>Nota médica:</b> {cliente.notaMedica}
              </div>
            )}
          </div>
          <button onClick={armarRutina} disabled={creando} className="btn btn-primary btn-block">
            <i className="ph ph-squares-four" /> {creando ? "Creando…" : "Armar rutina"}
          </button>
        </div>

        <div>
          <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 6px" }}>Rutinas de {cliente.nombre.split(" ")[0]}</h2>
          <p style={{ fontSize: 13.5, opacity: 0.6, margin: "0 0 18px" }}>
            Cada programa es un mesociclo de semanas configurables. Duplicalo para arrancar el siguiente bloque sin reescribir nada.
          </p>

          {cliente.asignaciones.length === 0 && (
            <div style={{ fontSize: 13.5, opacity: 0.55, marginBottom: 24 }}>Todavía no le asignaste ningún programa.</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 30 }}>
            {cliente.asignaciones.map((a, i) => {
              const estado = ESTADO_LABEL[a.programa.estado] ?? ESTADO_LABEL.BORRADOR;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 18px", borderRadius: 14, background: "var(--color-surface)" }}>
                  <div style={{ width: 46, textAlign: "center", flex: "none" }}>
                    <div style={{ fontSize: 10.5, textTransform: "uppercase", opacity: 0.5 }}>Bloque</div>
                    <div style={{ fontFamily: "var(--font-heading)", fontSize: 24 }}>{cliente.asignaciones.length - 1 - i}</div>
                  </div>
                  <div style={{ width: 1, alignSelf: "stretch", background: "var(--color-divider)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{a.programa.nombre}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.55 }}>{a.programa.semanas} semanas · {a.programa.frecuencia} · objetivo {a.programa.objetivo}</div>
                  </div>
                  <span className={`tag ${estado.clase}`}>{estado.texto}</span>
                  <button onClick={() => vals.goBuilder(a.programa.id)} className="btn btn-secondary">Editar</button>
                  <button onClick={() => { vals.setTemaPdfSel("clean"); vals.setProgramaIdActivo(a.programa.id); vals.goPdf(); }} className="btn btn-ghost">Ver PDF</button>
                  <button onClick={() => duplicarPrograma(a.programa.id)} className="btn btn-ghost" title="Duplicar como plantilla">
                    <i className="ph ph-copy" />
                  </button>
                </div>
              );
            })}
          </div>

          <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Cumplimiento de las últimas 4 semanas</h3>
          {cumplimiento.length === 0 ? (
            <div style={{ fontSize: 13.5, opacity: 0.55 }}>Sin datos de cumplimiento todavía.</div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150, padding: 16, borderRadius: 14, background: "var(--color-surface)" }}>
              {cumplimiento.map((c) => (
                <div key={c.semana} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 11, opacity: 0.55 }}>{c.porcentaje}%</div>
                  <div style={{ width: "100%", height: `${c.porcentaje}%`, background: "var(--color-accent)", borderRadius: "5px 5px 0 0" }} />
                  <div style={{ fontSize: 11, opacity: 0.5 }}>S{c.semana}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}