"use client";

import { useState } from "react";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ProgramaApi, BloqueApi, FocoBloque, TipoBloque } from "@/lib/types";
import { pctParaSemana, repsParaSemana } from "@/lib/rutinas/progresion";
import NumberStepper from "@/components/NumberStepper";

function descansoASegundos(descanso: string): number {
  const [m, s] = descanso.split(":").map((n) => Number(n) || 0);
  return m * 60 + s;
}

function segundosADescanso(totalSegundos: number): string {
  const t = Math.max(0, totalSegundos);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
  const [repsBase, setRepsBase] = useState(bloqueExistente?.sobrecarga[0]?.reps ?? repsParaSemana(1));
  const [cargaBase, setCargaBase] = useState(bloqueExistente?.sobrecarga[0]?.pct ?? pctParaSemana(1));
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
      let res: Response;
      if (bloqueExistente) {
        res = await fetch(`/api/coach/bloques/${bloqueExistente.id}`, {
          method: "PATCH",
          body: JSON.stringify({ tipo, foco, titulo, detalle, meta: meta || null, sobrecarga }),
        });
      } else if (vals.editorDiaId) {
        res = await fetch(`/api/coach/dias/${vals.editorDiaId}/bloques`, {
          method: "POST",
          body: JSON.stringify({ tipo, foco, titulo, detalle, meta: meta || undefined, seriesBase, repsBase, cargaBase, descansoBase }),
        });
      } else {
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        vals.showToast(data?.error ?? "No se pudo guardar el ejercicio");
        return;
      }
      vals.showToast(bloqueExistente ? "Cambios guardados" : "Ejercicio agregado al día");
      vals.cerrarEditor();
      onGuardado();
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!bloqueExistente) return;
    const res = await fetch(`/api/coach/bloques/${bloqueExistente.id}`, { method: "DELETE" });
    if (!res.ok) {
      vals.showToast("No se pudo borrar el ejercicio");
      return;
    }
    vals.showToast("Ejercicio borrado");
    vals.cerrarEditor();
    onGuardado();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", padding: 24, background: "rgba(0,0,0,.78)", backdropFilter: "blur(4px)" }}>
      <div style={{ width: "min(860px,100%)", maxHeight: "88vh", overflow: "auto", borderRadius: 14, background: "var(--color-surface-sunken)", boxShadow: "0 0 0 1px rgba(244,244,245,.13), 0 16px 40px rgba(0,0,0,.75)", padding: "20px 22px" }}>
        <div style={{ marginBottom: 12 }}>
          <span className="tag tag-outline">Por series</span>
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
                  background: foco === f.valor ? "rgba(232,40,40,.16)" : "transparent",
                  color: foco === f.valor ? "#FF7A7A" : "var(--color-text)",
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
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(244,244,245,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-stack" /> Series</div>
            <NumberStepper value={seriesBase} onChange={setSeriesBase} min={1} disabled={!!bloqueExistente} />
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>por ejercicio</div>
          </div>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(244,244,245,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-repeat" /> Repeticiones</div>
            <NumberStepper value={repsBase} onChange={setRepsBase} min={1} disabled={!!bloqueExistente} />
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>por serie</div>
          </div>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(244,244,245,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-trend-up" /> Carga</div>
            <NumberStepper value={cargaBase} onChange={setCargaBase} step={5} min={0} max={100} disabled={!!bloqueExistente} format={(v) => `${v}%`} />
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>%1RM · progresiva</div>
          </div>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(244,244,245,.14)", background: "var(--color-surface)", textAlign: "center" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.5 }}><i className="ph ph-timer" /> Descanso</div>
            <NumberStepper
              value={descansoASegundos(descansoBase)}
              onChange={(segundos) => setDescansoBase(segundosADescanso(segundos))}
              step={15}
              min={0}
              disabled={!!bloqueExistente}
              format={segundosADescanso}
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