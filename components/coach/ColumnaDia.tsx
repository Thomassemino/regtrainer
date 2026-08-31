"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { DiaProgramaApi } from "@/lib/types";
import { NOMBRES_DIA } from "@/lib/rutinas/dias";
import TarjetaBloque from "./TarjetaBloque";

export default function ColumnaDia({
  dia,
  diasDisponibles,
  onAbrirEditor,
  onConvertirEntrenable,
  onCambiarCalentamiento,
  onDuplicarDia,
}: {
  dia: DiaProgramaApi;
  diasDisponibles: DiaProgramaApi[];
  onAbrirEditor: (diaId: string, bloqueId: string | null) => void;
  onConvertirEntrenable: (diaId: string) => void;
  onCambiarCalentamiento: (diaId: string, valor: string) => void;
  onDuplicarDia: (origenDiaId: string, destinoDiaId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: dia.id, data: { esColumna: true } });
  const [duplicando, setDuplicando] = useState(false);

  const elegirDestino = (destinoDiaId: string) => {
    setDuplicando(false);
    if (!destinoDiaId) return;
    const nombreDestino = NOMBRES_DIA[diasDisponibles.find((d) => d.id === destinoDiaId)?.diaSemana ?? 0];
    if (window.confirm(`Esto reemplaza lo que tenga cargado ${nombreDestino}. ¿Duplicar ${NOMBRES_DIA[dia.diaSemana]} ahí?`)) {
      onDuplicarDia(dia.id, destinoDiaId);
    }
  };

  if (dia.descanso) {
    return (
      <div style={{ border: "1px solid var(--color-divider)", borderRadius: 12, background: "var(--color-surface-sunken)", padding: 14, minHeight: 300, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{NOMBRES_DIA[dia.diaSemana]}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--color-surface)", display: "grid", placeItems: "center" }}>
            <i className="ph ph-moon" style={{ fontSize: 22, color: "var(--color-accent)" }} />
          </div>
          <div style={{ fontSize: 13.5, opacity: 0.7 }}>Día de Descanso</div>
          <button onClick={() => onConvertirEntrenable(dia.id)} className="btn btn-ghost" style={{ fontSize: 12 }}>
            <i className="ph ph-plus-circle" /> Convertir a entrenamiento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={{ border: "1px solid var(--color-divider)", borderRadius: 12, background: "var(--color-surface-sunken)", padding: 14, minHeight: 300, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{NOMBRES_DIA[dia.diaSemana]}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.4 }}>{dia.bloques.length > 0 ? `${dia.bloques.length} bloques` : "Sin cargar"}</div>
          {diasDisponibles.length > 0 && (
            duplicando ? (
              <select
                autoFocus
                defaultValue=""
                onChange={(e) => elegirDestino(e.target.value)}
                onBlur={() => setDuplicando(false)}
                style={{ fontSize: 11, background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-divider)", borderRadius: 6 }}
              >
                <option value="" disabled>Duplicar en…</option>
                {diasDisponibles.map((d) => (
                  <option key={d.id} value={d.id}>{NOMBRES_DIA[d.diaSemana]}</option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => setDuplicando(true)}
                className="btn btn-ghost"
                title="Duplicar día"
                style={{ padding: 2, minWidth: 0, height: "auto" }}
              >
                <i className="ph ph-copy" />
              </button>
            )
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.45, marginBottom: 4 }}>Calentamiento</div>
        <textarea
          className="input"
          style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.9, minHeight: 44 }}
          defaultValue={dia.calentamiento ?? ""}
          placeholder="Texto libre"
          onBlur={(e) => onCambiarCalentamiento(dia.id, e.target.value)}
        />
      </div>

      <div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.45, marginBottom: 4 }}>Entrenamiento</div>
        <SortableContext items={dia.bloques.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dia.bloques.map((b) => (
              <TarjetaBloque key={b.id} bloque={b} onAbrir={() => onAbrirEditor(dia.id, b.id)} />
            ))}
          </div>
        </SortableContext>
        <button
          onClick={() => onAbrirEditor(dia.id, null)}
          style={{ marginTop: 8, width: "100%", height: 30, border: "1px dashed rgba(244,244,245,.18)", borderRadius: 8, background: "transparent", color: "rgba(244,244,245,.45)", cursor: "pointer" }}
        >
          +
        </button>
      </div>
    </div>
  );
}