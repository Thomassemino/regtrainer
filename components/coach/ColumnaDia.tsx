"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { DiaProgramaApi } from "@/lib/types";
import { NOMBRES_DIA } from "@/lib/rutinas/dias";
import TarjetaBloque from "./TarjetaBloque";

export default function ColumnaDia({
  dia,
  onAbrirEditor,
  onConvertirEntrenable,
  onCambiarCalentamiento,
}: {
  dia: DiaProgramaApi;
  onAbrirEditor: (diaId: string, bloqueId: string | null) => void;
  onConvertirEntrenable: (diaId: string) => void;
  onCambiarCalentamiento: (diaId: string, valor: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: dia.id, data: { esColumna: true } });

  if (dia.descanso) {
    return (
      <div style={{ border: "1px solid var(--color-divider)", borderRadius: 14, background: "#1b1d2c", padding: 14, minHeight: 300, display: "flex", flexDirection: "column" }}>
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
    <div ref={setNodeRef} style={{ border: "1px solid var(--color-divider)", borderRadius: 14, background: "#1b1d2c", padding: 14, minHeight: 300, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{NOMBRES_DIA[dia.diaSemana]}</div>
        <div style={{ fontSize: 11, opacity: 0.4 }}>{dia.bloques.length > 0 ? `${dia.bloques.length} bloques` : "Sin cargar"}</div>
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
          style={{ marginTop: 8, width: "100%", height: 30, border: "1px dashed var(--color-divider)", borderRadius: 10, background: "transparent", color: "rgba(233,233,237,.45)", cursor: "pointer" }}
        >
          +
        </button>
      </div>
    </div>
  );
}