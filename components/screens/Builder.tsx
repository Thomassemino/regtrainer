"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { BetoVals } from "@/hooks/useBetoApp";
import type { ProgramaApi } from "@/lib/types";
import { ORDEN_SEMANA } from "@/lib/rutinas/dias";
import ColumnaDia from "@/components/coach/ColumnaDia";
import EditorEjercicio from "@/components/screens/EditorEjercicio";
import Loader from "@/components/Loader";

export default function Builder({ vals }: { vals: BetoVals }) {
  const [programa, setPrograma] = useState<ProgramaApi | null>(null);

  const cargar = async () => {
    if (!vals.programaIdActivo) return;
    const res = await fetch(`/api/coach/programas/${vals.programaIdActivo}`);
    const data = await res.json();
    setPrograma(data.programa ?? null);
  };

  useEffect(() => {
    if (!vals.programaIdActivo) return;
    fetch(`/api/coach/programas/${vals.programaIdActivo}`)
      .then((r) => r.json())
      .then((data) => setPrograma(data.programa ?? null));
  }, [vals.programaIdActivo]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const diasOrdenados = useMemo(() => {
    if (!programa) return [];
    return ORDEN_SEMANA.map((diaSemana) => programa.dias.find((d) => d.diaSemana === diaSemana)).filter((d): d is NonNullable<typeof d> => !!d);
  }, [programa]);

  const volumen = useMemo(() => {
    if (!programa) return { diasEntrenamiento: 0, bloquesCargados: 0, seriesTotales: 0 };
    const diasEntrenamiento = programa.dias.filter((d) => !d.descanso).length;
    const todosLosBloques = programa.dias.flatMap((d) => d.bloques);
    const seriesTotales = todosLosBloques.reduce((acc, b) => {
      const fila = b.sobrecarga.find((f) => f.semana === vals.semanaSel);
      return acc + (fila?.series ?? 0);
    }, 0);
    return { diasEntrenamiento, bloquesCargados: todosLosBloques.length, seriesTotales };
  }, [programa, vals.semanaSel]);

  const agregarSemana = async () => {
    if (!vals.programaIdActivo) return;
    const res = await fetch(`/api/coach/programas/${vals.programaIdActivo}/semanas`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      vals.showToast(`Semana ${data.programa.semanas} agregada al bloque`);
      vals.setSemanaSel(data.programa.semanas);
      await cargar();
    }
  };

  const convertirEntrenable = async (diaId: string) => {
    await fetch(`/api/coach/dias/${diaId}`, { method: "PATCH", body: JSON.stringify({ descanso: false }) });
    await cargar();
  };

  const cambiarCalentamiento = async (diaId: string, calentamiento: string) => {
    await fetch(`/api/coach/dias/${diaId}`, { method: "PATCH", body: JSON.stringify({ calentamiento }) });
  };

  const duplicarDia = async (origenDiaId: string, destinoDiaId: string) => {
    const res = await fetch(`/api/coach/dias/${origenDiaId}/duplicar`, {
      method: "POST",
      body: JSON.stringify({ destinoDiaId }),
    });
    if (res.ok) {
      vals.showToast("Día duplicado");
      await cargar();
    } else {
      const data = await res.json().catch(() => null);
      vals.showToast(data?.error ?? "No se pudo duplicar el día");
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !programa) return;

    const diaOrigenId = (active.data.current as { diaId?: string } | undefined)?.diaId;
    if (!diaOrigenId) return;

    const overEsColumna = (over.data.current as { esColumna?: boolean } | undefined)?.esColumna === true;
    const diaDestinoId = overEsColumna ? String(over.id) : (over.data.current as { diaId?: string } | undefined)?.diaId;
    if (!diaDestinoId) return;

    const diaOrigen = programa.dias.find((d) => d.id === diaOrigenId);
    const diaDestino = programa.dias.find((d) => d.id === diaDestinoId);
    if (!diaOrigen || !diaDestino) return;

    if (diaOrigenId === diaDestinoId) {
      const ids = diaOrigen.bloques.map((b) => b.id);
      const desde = ids.indexOf(String(active.id));
      const hasta = overEsColumna ? ids.length - 1 : ids.indexOf(String(over.id));
      if (desde === -1 || hasta === -1 || desde === hasta) return;
      const nuevoOrden = [...ids];
      nuevoOrden.splice(desde, 1);
      nuevoOrden.splice(hasta, 0, String(active.id));

      setPrograma((p) => p && ({
        ...p,
        dias: p.dias.map((d) => (d.id === diaOrigenId ? { ...d, bloques: nuevoOrden.map((id) => d.bloques.find((b) => b.id === id)!) } : d)),
      }));

      await fetch(`/api/coach/dias/${diaOrigenId}/reordenar`, { method: "PATCH", body: JSON.stringify({ bloqueIds: nuevoOrden }) });
      return;
    }

    const idsDestino = diaDestino.bloques.map((b) => b.id).filter((id) => id !== String(active.id));
    idsDestino.push(String(active.id));
    const idsOrigen = diaOrigen.bloques.map((b) => b.id).filter((id) => id !== String(active.id));

    await fetch(`/api/coach/dias/${diaDestinoId}/reordenar`, {
      method: "PATCH",
      body: JSON.stringify({ bloqueIds: idsDestino, diaOrigenId, ordenOrigen: idsOrigen }),
    });
    await cargar();
  };

  if (!programa) {
    return <Loader label="Cargando constructor…" />;
  }

  return (
    <div>
      <style>{`
        .builder-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;align-items:start}
        @media (max-width:1100px){.builder-grid{grid-template-columns:repeat(2,1fr)}}
        @media (max-width:640px){.builder-grid{grid-template-columns:1fr}}
      `}</style>
      <div style={{ position: "sticky", top: 57, zIndex: 20, background: "rgba(0,0,0,.93)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1560, margin: "0 auto", padding: "11px clamp(12px, 3vw, 24px)", display: "flex", alignItems: "center", gap: 14, rowGap: 8, flexWrap: "wrap" }}>
          <button onClick={vals.back} className="btn btn-ghost"><i className="ph ph-arrow-left" /></button>
          <div style={{ fontSize: 15, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{programa.nombre}</div>
          <span className="tag tag-outline">{programa.estado === "ASIGNADO" ? "Asignado" : "Sin asignar"}</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 8, border: "1px solid var(--color-divider)", flexWrap: "wrap" }}>
            {Array.from({ length: programa.semanas }, (_, i) => i + 1).map((semana) => (
              <button
                key={semana}
                onClick={() => vals.setSemanaSel(semana)}
                style={{
                  width: 28, height: 24, borderRadius: 6, fontSize: 13, border: 0, cursor: "pointer",
                  background: vals.semanaSel === semana ? "rgba(232,40,40,.20)" : "transparent",
                  color: vals.semanaSel === semana ? "#FF7A7A" : "rgba(244,244,245,.6)",
                }}
              >
                {semana}
              </button>
            ))}
            {programa.semanas < 8 && (
              <button onClick={agregarSemana} style={{ width: 28, height: 24, borderRadius: 6, fontSize: 13, border: 0, cursor: "pointer", background: "transparent", color: "rgba(244,244,245,.6)" }}>
                +
              </button>
            )}
          </div>
          <button onClick={vals.goAsignar} className="btn btn-primary">Continuar →</button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="builder-grid" style={{ maxWidth: 1560, margin: "0 auto", padding: "18px clamp(12px, 3vw, 24px)" }}>
          {diasOrdenados.map((dia) => (
            <ColumnaDia
              key={dia.id}
              dia={dia}
              diasDisponibles={diasOrdenados.filter((d) => d.id !== dia.id)}
              onAbrirEditor={vals.abrirEditor}
              onConvertirEntrenable={convertirEntrenable}
              onCambiarCalentamiento={cambiarCalentamiento}
              onDuplicarDia={duplicarDia}
            />
          ))}
          {diasOrdenados.length < 7 && <div className="rt-hide-md" style={{ width: "100%", maxWidth: 320, minHeight: 300 }} />}

          <div style={{ border: "1px solid var(--color-divider)", borderRadius: 14, background: "var(--color-surface-sunken)", padding: 14, minHeight: 300 }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--color-accent)" }}>Volumen semanal</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 500, marginTop: 6 }}>{volumen.seriesTotales} series</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14, fontSize: 12.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Días de entrenamiento</span><span>{volumen.diasEntrenamiento} de 7</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Bloques cargados</span><span>{volumen.bloquesCargados}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Series totales (semana {vals.semanaSel})</span><span>{volumen.seriesTotales}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ opacity: 0.55 }}>Trabajo en carrera</span><span>—</span></div>
            </div>
            <div className="hr" />
            <div style={{ fontSize: 11.5, opacity: 0.5 }}>Se recalcula solo con lo que cargás en cada día del bloque.</div>
          </div>
        </div>
      </DndContext>

      {vals.editorOpen && <EditorEjercicio vals={vals} programa={programa} onGuardado={cargar} />}
    </div>
  );
}