"use client";

import { useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ProgramaApi, BloqueApi, FocoBloque, TipoBloque } from "@/lib/types";
import { pctParaSemana, repsParaSemana } from "@/lib/rutinas/progresion";

const TIPOS: { valor: TipoBloque; label: string }[] = [
  { valor: "TRADICIONAL", label: "Tradicional" },
  { valor: "SECUENCIA", label: "Secuencia" },
  { valor: "SUPERSERIE", label: "Superserie" },
  { valor: "EMOM", label: "EMOM" },
  { valor: "POR_TIEMPO", label: "Por tiempo" },
];

const FOCOS: { valor: FocoBloque; label: string }[] = [
  { valor: "TECNICA", label: "Técnica" },
  { valor: "RITMO", label: "Ritmo" },
  { valor: "MAXIMO_ESFUERZO", label: "Máximo esfuerzo" },
];

export default function EditorEjercicio({
  vals,
  programa,
  onGuardado,
}: {
  vals: BetoVals;
  programa: ProgramaApi;
  onGuardado: () => void;
}) {
  const bloqueExistente: BloqueApi | undefined = programa.dias
    .flatMap((d) => d.bloques)
    .find((b) => b.id === vals.editorBloqueId);

  const [tipo, setTipo] = useState<TipoBloque>(bloqueExistente?.tipo ?? "TRADICIONAL");
  const [foco, setFoco] = useState<FocoBloque>(bloqueExistente?.foco ?? "TECNICA");
  const [titulo, setTitulo] = useState(bloqueExistente?.titulo ?? "");
  const [detalle, setDetalle] = useState(bloqueExistente?.detalle ?? "");
  const [meta, setMeta] = useState(bloqueExistente?.meta ?? "");
  const [seriesBase, setSeriesBase] = useState(bloqueExistente?.sobrecarga[0]?.series ?? 4);
  const [descansoBase, setDescansoBase] = useState(bloqueExistente?.sobrecarga[0]?.descanso ?? "02:00");
  const [sobrecarga, setSobrecarga] = useState(bloqueExistente?.sobrecarga ?? []);
  const [guardando, setGuardando] = useState(false);

  const actualizarFila = (semana: number, campo: "series" | "reps" | "pct" | "descanso", valor: string) => {
    setSobrecarga((filas) =>
      filas.map((f) => (f.semana === semana ? { ...f, [campo]: campo === "descanso" ? valor : Number(valor) } : f)),
    );
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      if (bloqueExistente) {
        await fetch(`/api/coach/bloques/${bloqueExistente.id}`, {
          method: "PATCH",
          body: JSON.stringify({ tipo, foco, titulo, detalle, meta: meta || null, sobrecarga }),
        });
      } else if (vals.editorDiaId) {
        await fetch(`/api/coach/dias/${vals.editorDiaId}/bloques`, {
          method: "POST",
          body: JSON.stringify({ tipo, foco, titulo, detalle, meta: meta || undefined, seriesBase, descansoBase }),
        });
      }
      vals.showToast("Bloque guardado con su sobrecarga");
      vals.cerrarEditor();
      onGuardado();
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!bloqueExistente) return;
    await fetch(`/api/coach/bloques/${bloqueExistente.id}`, { method: "DELETE" });
    vals.cerrarEditor();
    onGuardado();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", padding: 24, background: "rgba(22,24,38,.72)", backdropFilter: "blur(4px)" }}>
      <div style={{ width: "min(860px,100%)", maxHeight: "88vh", overflow: "auto", borderRadius: 16, background: "#1b1d2c", boxShadow: "0 0 0 1px #3f424d, 0 16px 40px rgba(0,0,0,.65)", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span className="tag tag-outline">Por series</span>
          <button className="btn btn-secondary" disabled title="Próximamente">
            <i className="ph ph-book-open" /> Guía de ejecución
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <button onClick={vals.cerrarEditor} className="btn btn-ghost"><i className="ph ph-arrow-left" /></button>
          <select className="input" style={{ width: "auto" }} value={tipo} onChange={(e) => setTipo(e.target.value as TipoBloque)}>
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 6 }}>
            {FOCOS.map((f) => (
              <button
                key={f.valor}
                onClick={() => setFoco(f.valor)}
                style={{
                  padding: "7px 14px", borderRadius: 99, fontSize: 13, cursor: "pointer",
                  border: `1px solid ${foco === f.valor ? "var(--color-accent)" : "var(--color-divider)"}`,
                  background: foco === f.valor ? "rgba(145,132,217,.16)" : "transparent",
                  color: foco === f.valor ? "var(--color-accent-300)" : "var(--color-text)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <input
          className="input"
          style={{ maxWidth: 420, minHeight: 42, fontSize: 15, margin: "0 auto 8px", display: "block", textAlign: "center" }}
          placeholder="Nombre del ejercicio"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <input
          className="input"
          style={{ maxWidth: 420, margin: "0 auto 16px", display: "block", textAlign: "center" }}
          placeholder="Detalle (p. ej. 5 × 3 · @ 80% 1RM)"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
        />
        <input
          className="input"
          style={{ maxWidth: 420, margin: "0 auto 16px", display: "block", textAlign: "center" }}
          placeholder="Meta (p. ej. 4 ejercicios)"
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(233,233,237,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-stack" /> Series</div>
            <input
              type="number" min={1}
              value={seriesBase}
              onChange={(e) => setSeriesBase(Number(e.target.value))}
              disabled={!!bloqueExistente}
              style={{ width: "100%", textAlign: "center", fontSize: 22, fontWeight: 500, background: "transparent", border: 0, color: "var(--color-text)" }}
            />
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>por ejercicio</div>
          </div>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(233,233,237,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-repeat" /> Repeticiones</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{repsParaSemana(1)}</div>
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>por serie</div>
          </div>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(233,233,237,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-trend-up" /> Carga</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{pctParaSemana(1)}</div>
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>%1RM · progresiva</div>
          </div>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(233,233,237,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-timer" /> Descanso</div>
            <input
              value={descansoBase}
              onChange={(e) => setDescansoBase(e.target.value)}
              disabled={!!bloqueExistente}
              style={{ width: "100%", textAlign: "center", fontSize: 22, fontWeight: 500, background: "transparent", border: 0, color: "var(--color-text)" }}
            />
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>entre series</div>
          </div>
        </div>

        {bloqueExistente && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: "var(--color-accent)" }}><i className="ph ph-trend-up" /> Sobrecarga</span>
              <span className="tag tag-accent">Intensidad</span>
            </div>
            <table className="table">
              <thead>
                <tr><th>Semana</th><th style={{ textAlign: "center" }}>Series</th><th style={{ textAlign: "center" }}>Reps</th><th style={{ textAlign: "center" }}>%1RM</th><th style={{ textAlign: "center" }}>Descanso</th></tr>
              </thead>
              <tbody>
                {sobrecarga.map((f) => (
                  <tr key={f.semana}>
                    <td>{f.semana}</td>
                    <td style={{ textAlign: "center" }}><input type="number" className="input" style={{ width: 60, textAlign: "center" }} value={f.series} onChange={(e) => actualizarFila(f.semana, "series", e.target.value)} /></td>
                    <td style={{ textAlign: "center" }}><input type="number" className="input" style={{ width: 60, textAlign: "center" }} value={f.reps} onChange={(e) => actualizarFila(f.semana, "reps", e.target.value)} /></td>
                    <td style={{ textAlign: "center" }}><input type="number" className="input" style={{ width: 60, textAlign: "center" }} value={f.pct} onChange={(e) => actualizarFila(f.semana, "pct", e.target.value)} /></td>
                    <td style={{ textAlign: "center" }}><input className="input" style={{ width: 70, textAlign: "center" }} value={f.descanso} onChange={(e) => actualizarFila(f.semana, "descanso", e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <p style={{ fontSize: 11.5, opacity: 0.45, margin: "16px 0" }}>La progresión se programa una vez y se aplica a todo el bloque.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {bloqueExistente && <button onClick={borrar} className="btn btn-ghost">Borrar bloque</button>}
          <button onClick={vals.cerrarEditor} className="btn btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={guardando || !titulo || !detalle} className="btn btn-primary">
            <i className="ph ph-check" /> Guardar bloque
          </button>
        </div>
      </div>
    </div>
  );
}