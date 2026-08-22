"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BloqueApi } from "@/lib/types";

const TIPO_CLASE: Record<BloqueApi["tipo"], string> = {
  TRADICIONAL: "tag-accent",
  SECUENCIA: "tag-accent-2",
  SUPERSERIE: "tag-neutral",
  EMOM: "tag-outline",
  POR_TIEMPO: "tag-outline",
};

const TIPO_LABEL: Record<BloqueApi["tipo"], string> = {
  TRADICIONAL: "Tradicional",
  SECUENCIA: "Secuencia",
  SUPERSERIE: "Superserie",
  EMOM: "EMOM",
  POR_TIEMPO: "Por tiempo",
};

const FOCO_COLOR: Record<BloqueApi["foco"], string> = {
  TECNICA: "var(--color-accent-400)",
  RITMO: "var(--color-accent-2-400)",
  MAXIMO_ESFUERZO: "var(--color-neutral-200)",
};

const FOCO_LABEL: Record<BloqueApi["foco"], string> = {
  TECNICA: "Técnica",
  RITMO: "Ritmo",
  MAXIMO_ESFUERZO: "Máximo esfuerzo",
};

export default function TarjetaBloque({ bloque, onAbrir }: { bloque: BloqueApi; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bloque.id,
    data: { diaId: bloque.diaId },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onAbrir}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: "pointer",
        padding: "10px 12px",
        borderRadius: 10,
        background: "var(--color-surface)",
        borderLeft: "2px solid var(--color-accent-800)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 4, gap: 7 }}>
        <span className={`tag ${TIPO_CLASE[bloque.tipo]}`} style={{ padding: "1px 7px", whiteSpace: "nowrap" }}>{TIPO_LABEL[bloque.tipo]}</span>
        {bloque.meta && <span style={{ fontSize: 10.5, opacity: 0.4 }}>{bloque.meta}</span>}
        <span style={{ marginLeft: "auto", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: FOCO_COLOR[bloque.foco] }}>
          {FOCO_LABEL[bloque.foco]}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginTop: 4 }}>{bloque.titulo}</div>
      <div style={{ fontSize: 11.5, opacity: 0.55, lineHeight: 1.35 }}>{bloque.detalle}</div>
    </div>
  );
}